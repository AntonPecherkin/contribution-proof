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
  /** null means the provider did not report it. NOT zero. */
  viewsTotal: number | null;
  conversationsTotal: number | null;
};

export function computeScore(_input: ScoreInput): { components: Components; total: number } {
  throw new Error('not implemented — see docs/tasks/C1-scoring.md');
}
