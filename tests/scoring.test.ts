import { describe, expect, it } from 'vitest';
import { computeScore } from '../src/lib/scoring';

/**
 * SKIPPED until task C1 implements it. Un-skip as your first step, watch it fail, then
 * make it pass. Do not change an assertion — if you believe one is wrong, say so in the
 * PR and leave it.
 */
const base = {
  eligibleCount: 20,
  relevantCount: 0,
  explanationRatings: [] as number[],
  longestStreakWeeks: 0,
  viewsTotal: 0 as number | null,
  conversationsTotal: 0 as number | null,
};

describe('computeScore', () => {
  it('floors a full analysis at 100, so it can never fall into profile-score territory', () => {
    // Zero technology posts still means a real analysis happened. It ranks last among
    // analyses, not below an account we could not read at all.
    expect(computeScore(base).total).toBe(100);
    expect(computeScore(base).components).toEqual({
      relevance: 0, explanation: 0, consistency: 0, response: 0,
    });
  });

  it('caps every component at 250', () => {
    const r = computeScore({
      eligibleCount: 20,
      relevantCount: 20,
      explanationRatings: Array(20).fill(1),
      longestStreakWeeks: 12,
      viewsTotal: 100_000_000,
      conversationsTotal: 1_000_000,
    });
    expect(r.components.relevance).toBe(250);
    expect(r.components.explanation).toBe(250);
    expect(r.components.consistency).toBe(250);
    expect(r.components.response).toBe(250);
    expect(r.total).toBe(1000);
  });

  it('caps consistency at four active weeks', () => {
    const four = computeScore({
      ...base, relevantCount: 8, explanationRatings: Array(8).fill(0.5),
      longestStreakWeeks: 4,
    });
    const twelve = computeScore({
      ...base, relevantCount: 8, explanationRatings: Array(8).fill(0.5),
      longestStreakWeeks: 12,
    });
    expect(four.components.consistency).toBe(twelve.components.consistency);
  });

  it('log-scales response so one viral post cannot dominate', () => {
    const one = computeScore({
      ...base, relevantCount: 1, explanationRatings: [1],
      longestStreakWeeks: 1, viewsTotal: 1_000_000,
    });
    const ten = computeScore({
      ...base, relevantCount: 1, explanationRatings: [1],
      longestStreakWeeks: 1, viewsTotal: 10_000_000,
    });
    expect(ten.components.response - one.components.response).toBeLessThan(40);
  });

  it('rounds the total to the nearest 10', () => {
    const r = computeScore({
      eligibleCount: 17,
      relevantCount: 11,
      explanationRatings: [0.8, 0.6, 0.9, 0.4, 0.7, 0.5, 0.9, 0.3, 0.6, 0.8, 0.7],
      longestStreakWeeks: 3,
      viewsTotal: 48_213,
      conversationsTotal: 311,
    });
    expect(r.total % 10).toBe(0);
  });

  it('scores zero for a popular account with no technology posts', () => {
    // The response component measures the response to the contribution. With no relevant
    // posts there is no contribution, and reach alone must not produce a score.
    const r = computeScore({
      ...base, relevantCount: 0, explanationRatings: [], longestStreakWeeks: 0, viewsTotal: 250_000, conversationsTotal: 900,
    });
    expect(r.components.response).toBe(0);
    expect(r.total).toBe(100);
  });

  it('returns whole-number components, because they are stored and displayed as integers', () => {
    const r = computeScore({
      eligibleCount: 17, relevantCount: 11,
      explanationRatings: [0.8, 0.6, 0.9, 0.4, 0.7, 0.5, 0.9, 0.3, 0.6, 0.8, 0.7],
      longestStreakWeeks: 3,
      viewsTotal: 48_213, conversationsTotal: 311,
    });
    for (const [name, value] of Object.entries(r.components)) {
      expect(Number.isInteger(value), `${name} = ${value}`).toBe(true);
    }
  });

  it('treats a null views value as absent, not as zero', () => {
    const nullViews = computeScore({
      ...base, relevantCount: 5, explanationRatings: Array(5).fill(0.6),
      longestStreakWeeks: 2,
      viewsTotal: null, conversationsTotal: null,
    });
    const zeroViews = computeScore({
      ...base, relevantCount: 5, explanationRatings: Array(5).fill(0.6),
      longestStreakWeeks: 2,
      viewsTotal: 0, conversationsTotal: 0,
    });
    expect(nullViews.components.response).not.toBe(zeroViews.components.response);
  });
});
