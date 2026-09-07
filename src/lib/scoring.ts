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
  /**
   * Longest run of CONSECUTIVE weeks containing a relevant post.
   *
   * Replaces a count of distinct active weeks, which rewarded sparsity: four posts scattered
   * across four years scored full marks, because four different weeks spread perfectly
   * evenly is, arithmetically, perfect consistency. A streak cannot be gamed that way, and
   * "your longest streak was 6 weeks" is a better thing to read than an evenness index.
   */
  longestStreakWeeks: number;
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
/** Weeks of unbroken activity that earn full marks. */
export const STREAK_TARGET = 4;

/**
 * A full analysis never scores below this, and a profile-only result never reaches it.
 *
 * The two live on one visible scale so every card reads the same way, but the ranges do not
 * overlap: a Profile Score tops out at 100 and a Contribution Score starts there. Nobody can
 * appear to beat twenty analysed posts with a bio, and nobody has to be told their number
 * belongs to a different system.
 */
export const CONTRIBUTION_FLOOR = 100;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
    : Math.round(CAP * (Math.min(Math.max(input.longestStreakWeeks, 0), STREAK_TARGET) / STREAK_TARGET));
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
  // The four components span 0-1000; the displayed total spans 100-1000, so that a full
  // analysis always outranks a profile-only result on the same scale.
  const raw = relevance + explanation + consistency + response;
  const total =
    CONTRIBUTION_FLOOR + Math.round((raw * (1000 - CONTRIBUTION_FLOOR)) / 1000 / 10) * 10;

  return { components, total };
}
