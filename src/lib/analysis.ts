import type { Classification } from './llm/schema';
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

export function toScoreInput(
  posts: readonly Post[],
  classification: Classification,
): ScoreInput {
  const eligible = posts.filter(isEligible);
  const judgement = new Map(classification.posts.map((p) => [p.id, p]));

  const relevant = eligible.filter((p) => judgement.get(p.id)?.isTechnology === true);

  const byWeek = new Map<string, number>();
  for (const p of relevant) {
    const key = weekKey(p.createdAt);
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  }

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
    activeWeeks: byWeek.size,
    relevantCountsByWeek: [...byWeek.values()],
    viewsTotal: sumOrNull((p) => p.views),
    conversationsTotal: sumOrNull((p) => p.replies),
  };
}
