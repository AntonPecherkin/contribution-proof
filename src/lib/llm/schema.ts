import { z } from 'zod';

import { TOPIC_IDS } from './taxonomy';

/**
 * Everything the model is allowed to decide. Deterministic code owns every number that
 * reaches the score, so nothing here is arithmetic — these are judgements, and the scoring
 * module turns them into points.
 */

export const PostJudgementSchema = z.object({
  id: z.string(),
  isTechnology: z.boolean(),
  /** 0..1. How far the post explains rather than merely mentions. See the rubric. */
  explanationRating: z.number().min(0).max(1),
  /** Topic ids from the fixed taxonomy. Anything else is dropped by the caller. */
  topics: z.array(z.string()),
});

export const ClassificationSchema = z.object({
  posts: z.array(PostJudgementSchema),
  /** 3-5 topic ids, most characteristic first. */
  powerTopics: z.array(z.string()),
  /** <= 60 words. Evidence only. */
  narrative: z.string(),
});

export type PostJudgement = z.infer<typeof PostJudgementSchema>;
export type Classification = z.infer<typeof ClassificationSchema>;

/**
 * A model can return a topic id that is not in the taxonomy, or rate a post it was not
 * given. Rather than trust the output, narrow it to what we asked for: unknown topics are
 * dropped, judgements for unknown post ids are dropped, and a post the model skipped is
 * treated as not-technology rather than silently absent.
 */
export function reconcile(raw: Classification, askedFor: readonly string[]): Classification {
  const asked = new Set(askedFor);
  const seen = new Map<string, PostJudgement>();

  for (const p of raw.posts) {
    if (!asked.has(p.id) || seen.has(p.id)) continue;
    seen.set(p.id, {
      ...p,
      explanationRating: Math.min(1, Math.max(0, p.explanationRating)),
      topics: p.topics.filter((t) => TOPIC_IDS.includes(t)),
    });
  }

  const posts = askedFor.map(
    (id) =>
      seen.get(id) ?? { id, isTechnology: false, explanationRating: 0, topics: [] },
  );

  return {
    posts,
    powerTopics: raw.powerTopics.filter((t) => TOPIC_IDS.includes(t)).slice(0, 5),
    narrative: raw.narrative.trim(),
  };
}
