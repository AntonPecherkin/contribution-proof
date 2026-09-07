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
  activeWeeks: 0,
  relevantCountsByWeek: [] as number[],
  viewsTotal: 0 as number | null,
  conversationsTotal: 0 as number | null,
};

describe('computeScore', () => {
  it('returns 0 when there is no relevant evidence', () => {
    expect(computeScore(base).total).toBe(0);
  });

  it('caps every component at 250', () => {
    const r = computeScore({
      eligibleCount: 20,
      relevantCount: 20,
      explanationRatings: Array(20).fill(1),
      activeWeeks: 12,
      relevantCountsByWeek: Array(12).fill(2),
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
      activeWeeks: 4, relevantCountsByWeek: [2, 2, 2, 2],
    });
    const twelve = computeScore({
      ...base, relevantCount: 8, explanationRatings: Array(8).fill(0.5),
      activeWeeks: 12, relevantCountsByWeek: Array(12).fill(2),
    });
    expect(four.components.consistency).toBe(twelve.components.consistency);
  });

  it('log-scales response so one viral post cannot dominate', () => {
    const one = computeScore({
      ...base, relevantCount: 1, explanationRatings: [1],
      activeWeeks: 1, relevantCountsByWeek: [1], viewsTotal: 1_000_000,
    });
    const ten = computeScore({
      ...base, relevantCount: 1, explanationRatings: [1],
      activeWeeks: 1, relevantCountsByWeek: [1], viewsTotal: 10_000_000,
    });
    expect(ten.components.response - one.components.response).toBeLessThan(40);
  });

  it('rounds the total to the nearest 10', () => {
    const r = computeScore({
      eligibleCount: 17,
      relevantCount: 11,
      explanationRatings: [0.8, 0.6, 0.9, 0.4, 0.7, 0.5, 0.9, 0.3, 0.6, 0.8, 0.7],
      activeWeeks: 3,
      relevantCountsByWeek: [5, 4, 2],
      viewsTotal: 48_213,
      conversationsTotal: 311,
    });
    expect(r.total % 10).toBe(0);
  });

  it('treats a null views value as absent, not as zero', () => {
    const nullViews = computeScore({
      ...base, relevantCount: 5, explanationRatings: Array(5).fill(0.6),
      activeWeeks: 2, relevantCountsByWeek: [3, 2],
      viewsTotal: null, conversationsTotal: null,
    });
    const zeroViews = computeScore({
      ...base, relevantCount: 5, explanationRatings: Array(5).fill(0.6),
      activeWeeks: 2, relevantCountsByWeek: [3, 2],
      viewsTotal: 0, conversationsTotal: 0,
    });
    expect(nullViews.components.response).not.toBe(zeroViews.components.response);
  });
});
