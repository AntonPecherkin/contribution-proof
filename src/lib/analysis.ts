import type { Classification } from './classify';
import { isEligible } from './normalize';
import type { Post } from './providers/types';
import type { ScoreInput } from './scoring';

/**
 * Turns posts plus the model's judgements into the pure scoring input.
 *
 * This is where the "relevant posts only" rule in ScoreInput is enforced. Reach totals span
 * the technology posts, not the account: a popular non-technology account should not collect
 * points for attention its contribution did not earn.
 */

/** Monday-anchored week key, so posts a few days apart do not land in different buckets. */
export function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day),
  );
  return monday.toISOString().slice(0, 10);
}

/** Longest run of consecutive calendar weeks in a sorted list of week keys. */
export function longestStreak(sortedWeeks: readonly string[]): number {
  if (sortedWeeks.length === 0) return 0;
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sortedWeeks.length; i += 1) {
    const gap = new Date(sortedWeeks[i]).getTime() - new Date(sortedWeeks[i - 1]).getTime();
    run = gap === WEEK ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export function toScoreInput(
  posts: readonly Post[],
  classification: Classification,
): ScoreInput {
  const eligible = posts.filter(isEligible);
  const judgement = new Map(classification.posts.map((p) => [p.id, p]));

  const relevant = eligible.filter((p) => judgement.get(p.id)?.isTechnology === true);

  const weeks = [...new Set(relevant.map((p) => weekKey(p.createdAt)))].sort();

  // A metric absent on every relevant post stays absent. Summing nulls into 0 would turn
  // "the provider did not report this" into "nobody saw it", which the score treats very
  // differently — and on this provider the absent case is the common one.
  const sumOrNull = (pick: (p: Post) => number | null): number | null => {
    const values = relevant.map(pick).filter((v): v is number => v !== null);
    return values.length === 0 ? null : values.reduce((a, b) => a + b, 0);
  };

  return {
    eligibleCount: eligible.length,
    relevantCount: relevant.length,
    explanationRatings: relevant.map((p) => judgement.get(p.id)?.explanationRating ?? 0),
    longestStreakWeeks: longestStreak(weeks),
    viewsTotal: sumOrNull((p) => p.views),
    conversationsTotal: sumOrNull((p) => p.replies),
  };
}
