/** Implemented by task C1. Signatures are part of the seam — do not change them. */

export type Components = {
  relevance: number;
  explanation: number;
  consistency: number;
  response: number;
};

export type ScoreInput = {
  eligibleCount: number;
  relevantCount: number;
  /** 0..1, one per relevant post. */
  explanationRatings: number[];
  activeWeeks: number;
  /** One entry per active week, for the spread factor. */
  relevantCountsByWeek: number[];
  /**
   * Totals over RELEVANT posts only — the response to the contribution, not to the
   * account. Passing account-wide totals would score a popular non-technology account
   * for reach it did not earn here.
   *
   * `null` means the provider did not report it. It is not zero.
   */
  viewsTotal: number | null;
  conversationsTotal: number | null;
};

export const CAP = 250;
export const NEUTRAL = 0.35;
export const VIEWS_CEILING = 500_000;
export const CONVERSATIONS_CEILING = 2_000;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function spreadFactor(counts: number[]): number {
  if (counts.length === 0) return 0;
  if (counts.length === 1) return 1;

  const total = counts.reduce((sum, count) => sum + Math.max(0, count), 0);
  if (total === 0) return 0;

  // Normalized Shannon entropy is 1 for an even spread and tends toward 0
  // as relevant posts concentrate in a single week.
  const entropy = counts.reduce((sum, count) => {
    const probability = Math.max(0, count) / total;
    return probability === 0 ? sum : sum - probability * Math.log(probability);
  }, 0);

  return clampUnit(entropy / Math.log(counts.length));
}

function reach(value: number | null, ceiling: number): number {
  if (value === null) return NEUTRAL;
  return clampUnit(Math.log1p(Math.max(0, value)) / Math.log1p(ceiling));
}

export function computeScore(input: ScoreInput): { components: Components; total: number } {
  // Components are whole numbers: they are stored in integer columns and shown to people,
  // so a fractional component would diverge between screen and database.
  const relevance = Math.round(
    CAP * clampUnit(input.relevantCount / Math.max(1, input.eligibleCount)),
  );
  const explanation = input.relevantCount === 0
    ? 0
    : Math.round(CAP * clampUnit(mean(input.explanationRatings)));
  const consistency = input.relevantCount === 0
    ? 0
    : Math.round(
        CAP * (Math.min(Math.max(input.activeWeeks, 0), 4) / 4)
          * spreadFactor(input.relevantCountsByWeek),
      );
  // No relevant posts means there is no contribution for anyone to have responded to.
  // Without this guard a popular non-technology account scores on reach alone.
  const response = input.relevantCount === 0
    ? 0
    : Math.round(
        CAP * (
          0.7 * reach(input.viewsTotal, VIEWS_CEILING)
          + 0.3 * reach(input.conversationsTotal, CONVERSATIONS_CEILING)
        ),
      );

  const components = { relevance, explanation, consistency, response };
  // Sum the rounded components so the visible parts add up to the visible whole.
  const total = Math.round(
    (relevance + explanation + consistency + response) / 10,
  ) * 10;

  return { components, total };
}
