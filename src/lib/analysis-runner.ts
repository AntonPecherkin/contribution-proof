import 'server-only';

import { after } from 'next/server';

import { toScoreInput } from './analysis';
import { track } from './analytics';
import { matchProjects } from './catalog';
import { classify } from './classify';
import { getDb } from './db';
import { evidenceBand } from './evidence';
import { isEligible } from './normalize';
import { getProvider } from './providers';
import type { Post, ProfileSummary } from './providers/types';
import type { PublicResult } from './result';
import { computeScore } from './scoring';
import { profileSignal } from './signal';
import { daysBuilding, funStats, peopleEngagedInTech } from './stats';

/**
 * Drives one analysis to completion.
 *
 * Collection takes 90-140 seconds and is asynchronous, so this runs in two acts: the first
 * call triggers and records a snapshot id, and later calls — driven by the participant's own
 * polling — try to resolve it. Nothing loops and nothing sleeps; the analyses row is the job,
 * and the poll is the scheduler.
 */

/** A row live for longer than this is presumed dropped and gets restarted. */
const STALE_MS = 45_000;

type Row = {
  id: string;
  event_id: string;
  x_handle_normalized: string;
  status: string;
  provider_snapshot_id: string | null;
  started_at: string | null;
};

async function fail(id: string, errorClass: string): Promise<void> {
  await getDb()
    .from('analyses')
    .update({ status: 'failed', error_class: errorClass, completed_at: new Date().toISOString() })
    .eq('id', id);
  await track('analysis_failed', { error_class: errorClass });
}

function buildScored(handle: string, profile: ProfileSummary, posts: Post[]): PublicResult | null {
  const classification = classify(posts);
  const input = toScoreInput(posts, classification);
  const band = evidenceBand(input.eligibleCount);
  // Zero eligible posts is not a score of zero; it is no score at all.
  if (band === null) return null;

  const { components, total } = computeScore(input);
  const stats = funStats(posts);
  if (stats === null) return null;

  return {
    kind: 'analysis',
    handle,
    displayName: profile.displayName || handle,
    score: total,
    components,
    evidence: band,
    eligibleCount: input.eligibleCount,
    technologyCount: input.relevantCount,
    powerTopics: classification.powerTopics,
    peopleEngaged: peopleEngagedInTech(posts, classification),
    daysBuilding: daysBuilding(profile.joinedAt),
    stats,
    opportunities: matchProjects(classification.powerTopics),
  };
}

async function complete(id: string, result: PublicResult, lane: 'warm' | 'cold'): Promise<void> {
  await getDb()
    .from('analyses')
    .update({
      status: 'complete',
      completed_at: new Date().toISOString(),
      score_total: result.score,
      eligible_post_count: result.kind === 'analysis' ? result.eligibleCount : null,
      evidence_band: result.kind === 'analysis' ? result.evidence : null,
      posts_technology: result.kind === 'analysis' ? result.technologyCount : null,
      // The board sums this column rather than scanning jsonb, so it has to be written here.
      // Without it every room total read "Not available" while the result page showed views.
      views_total: result.kind === 'analysis' ? result.stats.totalViews : null,
      topics: result.kind === 'analysis' ? result.powerTopics : result.signal.topics,
      result_kind: result.kind,
      result,
      // The derived cache: a completed row inside this window is served directly.
      cache_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', id);

  await track('analysis_completed', {
    lane,
    evidence_band: result.kind === 'analysis' ? result.evidence : 'none',
  });
}

/**
 * An account whose posts we could not read is a **result**, never an error.
 *
 * It is roughly a third of accounts and most of the room at a developer event. Falling
 * through to "our provider couldn't complete this request" would hand those people a
 * failure screen for something that is entirely our limitation, so this path cannot fail:
 * if the provider gave us no profile at all we synthesise the little we know rather than
 * degrade to an error.
 */
function profileResultFor(handle: string, profile: ProfileSummary | undefined): PublicResult {
  const known: ProfileSummary = profile ?? {
    handle,
    displayName: handle,
    bio: null,
    followers: null,
    following: null,
    postsCount: null,
    joinedAt: null,
    isVerified: false,
    location: null,
    externalLink: null,
  };
  const signal = profileSignal(known);
  return {
    kind: 'profile',
    handle,
    displayName: known.displayName || handle,
    score: signal.profileScore,
    signal,
    opportunities: matchProjects(signal.topics),
  };
}

export async function runAnalysis(id: string): Promise<void> {
  const db = getDb();
  const { data } = await db
    .from('analyses')
    .select('id,event_id,x_handle_normalized,status,provider_snapshot_id,started_at')
    .eq('id', id)
    .maybeSingle();

  const row = data as Row | null;
  if (!row || row.status === 'complete' || row.status === 'failed') return;

  const provider = await getProvider();
  const handle = row.x_handle_normalized;

  try {
    // Act two: a snapshot is already in flight.
    if (row.provider_snapshot_id) {
      const resolved = await provider.resolveSnapshot(row.provider_snapshot_id);
      if (!resolved.ok && 'pending' in resolved) return; // still collecting; poll again later

      if (!resolved.ok) {
        if (resolved.errorClass === 'no_posts_available') {
          return complete(id, profileResultFor(handle, resolved.profile), 'cold');
        }
        return fail(id, resolved.errorClass);
      }

      const posts = resolved.posts.filter(isEligible);
      const scored = buildScored(handle, resolved.profile, posts);
      return scored ? complete(id, scored, 'cold') : fail(id, 'empty');
    }

    // Act one: trigger collection.
    await db
      .from('analyses')
      .update({ status: 'fetching', started_at: new Date().toISOString(), provider: provider.name })
      .eq('id', id);

    const first = await provider.fetchRecentPosts(handle, 20);

    if (!first.ok && 'pending' in first) {
      await db
        .from('analyses')
        .update({ provider_snapshot_id: first.snapshotId })
        .eq('id', id);
      return;
    }

    if (!first.ok) {
      if (first.errorClass === 'no_posts_available') {
        return complete(id, profileResultFor(handle, first.profile), 'cold');
      }
      return fail(id, first.errorClass);
    }

    const posts = first.posts.filter(isEligible);
    const scored = buildScored(handle, first.profile, posts);
    return scored ? complete(id, scored, 'cold') : fail(id, 'empty');
  } catch {
    await fail(id, 'provider');
  }
}

/**
 * Restart work that stopped without finishing.
 *
 * A serverless function can be terminated mid-run, which would otherwise leave a row live
 * forever and a participant watching a spinner that will never resolve. A poll that finds a
 * stale row simply starts it again — no scheduler, no dead-letter queue.
 */
export function reviveIfStale(row: {
  status: string;
  started_at: string | null;
  provider_snapshot_id: string | null;
  id: string;
}): void {
  if (row.status === 'complete' || row.status === 'failed') return;
  const started = row.started_at ? new Date(row.started_at).getTime() : 0;
  const stale = Date.now() - started > STALE_MS;
  // A snapshot in flight is not stale — it is simply slow, and resolving it is the poll's job.
  if (row.provider_snapshot_id || stale) after(() => runAnalysis(row.id));
}
