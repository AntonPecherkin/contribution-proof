import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import type { Post } from '../providers/types';
import { RUBRIC, renderPosts } from './prompt';
import { ClassificationSchema, reconcile, type Classification } from './schema';

export type ClassifyResult =
  | { ok: true; classification: Classification; cacheReadTokens: number }
  | { ok: false; errorClass: 'llm' };

const MODEL = 'claude-opus-5';

/**
 * Built at call time, not module load, so tests can set the environment.
 *
 * Constructed with no arguments on purpose: the SDK resolves credentials itself, so an
 * environment variable and a stored auth profile both work. Requiring the variable
 * explicitly would reject a perfectly good profile.
 */
function client(): Anthropic | null {
  try {
    // An organization-scoped key must name a workspace on every request; a
    // workspace-scoped key must not. Supporting both means either kind of key works
    // without the caller having to know which they were given.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    return new Anthropic(
      workspaceId
        ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } }
        : undefined,
    );
  } catch {
    return null;
  }
}

async function attempt(
  anthropic: Anthropic,
  posts: readonly Post[],
  effort: 'low' | 'medium',
): Promise<ClassifyResult> {
  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort,
      format: zodOutputFormat(ClassificationSchema),
    },
    // The rubric is byte-identical for every participant, so it is cached and the posts are
    // appended after the breakpoint. At an event this prefix is read hundreds of times.
    system: [{ type: 'text', text: RUBRIC, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: renderPosts(posts) }],
  });

  const parsed = response.parsed_output;
  if (!parsed) return { ok: false, errorClass: 'llm' };

  return {
    ok: true,
    classification: reconcile(parsed, posts.map((p) => p.id)),
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
  };
}

/**
 * One structured request per analysis.
 *
 * Retries once at higher effort on a parse failure, then gives up. A second failure is not
 * fatal to the participant: the caller shows the metrics without the narrative rather than
 * showing nothing, because every number on the page was computed by us and none of it
 * depended on this call succeeding.
 */
/**
 * Swallowing the cause makes a failure here indistinguishable from a hundred others, and
 * costs an hour every time something upstream changes. Log it; never surface it to a
 * participant.
 */
function note(error: unknown): void {
  const e = error as { status?: number; message?: string };
  console.error(`[classify] ${e?.status ?? ''} ${e?.message?.slice(0, 300) ?? String(error)}`);
}

export async function classify(posts: readonly Post[]): Promise<ClassifyResult> {
  const anthropic = client();
  if (!anthropic) return { ok: false, errorClass: 'llm' };
  if (posts.length === 0) return { ok: false, errorClass: 'llm' };

  try {
    const first = await attempt(anthropic, posts, 'low');
    if (first.ok) return first;
  } catch (error) {
    note(error);
  }

  try {
    return await attempt(anthropic, posts, 'medium');
  } catch (error) {
    note(error);
    return { ok: false, errorClass: 'llm' };
  }
}
