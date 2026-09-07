import { describe, expect, it } from 'vitest';

import { toScoreInput, weekKey } from '../src/lib/analysis';
import type { Post } from '../src/lib/providers/types';

const post = (id: string, over: Partial<Post> = {}): Post => ({
  id, text: 't', createdAt: '2026-08-05T00:00:00.000Z',
  views: 100, replies: 5, reposts: 0, likes: 0,
  isReply: false, isRepost: false, isQuote: false,
  ...over,
});

const judged = (ids: Record<string, [boolean, number]>) => ({
  posts: Object.entries(ids).map(([id, [isTechnology, explanationRating]]) => ({
    id, isTechnology, explanationRating, topics: [], matched: [],
  })),
  powerTopics: [],
});

describe('weekKey', () => {
  it('anchors to Monday, so nearby days share a bucket', () => {
    expect(weekKey('2026-08-05T00:00:00.000Z')).toBe(weekKey('2026-08-07T23:00:00.000Z'));
  });

  it('separates genuinely different weeks', () => {
    expect(weekKey('2026-08-05T00:00:00.000Z')).not.toBe(weekKey('2026-08-13T00:00:00.000Z'));
  });
});

describe('toScoreInput', () => {
  it('counts only eligible posts and only technology among them', () => {
    const posts = [post('a'), post('b'), post('c', { isReply: true })];
    const out = toScoreInput(posts, judged({ a: [true, 0.8], b: [false, 0.1], c: [true, 0.9] }));
    expect(out.eligibleCount).toBe(2);
    expect(out.relevantCount).toBe(1);
    expect(out.explanationRatings).toEqual([0.8]);
  });

  it('sums reach over relevant posts only', () => {
    // The popular post here is not technology; its reach must not count.
    const posts = [post('a', { views: 10 }), post('b', { views: 1_000_000 })];
    const out = toScoreInput(posts, judged({ a: [true, 0.5], b: [false, 0] }));
    expect(out.viewsTotal).toBe(10);
  });

  it('keeps reach null when no relevant post reported it', () => {
    const posts = [post('a', { views: null, replies: null })];
    const out = toScoreInput(posts, judged({ a: [true, 0.5] }));
    expect(out.viewsTotal).toBeNull();
    expect(out.conversationsTotal).toBeNull();
  });

  it('sums the reported values when only some posts report them', () => {
    const posts = [post('a', { views: null }), post('b', { views: 40 })];
    const out = toScoreInput(posts, judged({ a: [true, 0.5], b: [true, 0.5] }));
    expect(out.viewsTotal).toBe(40);
  });

  it('measures the longest run of consecutive weeks', () => {
    const posts = [
      post('a', { createdAt: '2026-08-05T00:00:00.000Z' }),
      post('b', { createdAt: '2026-08-06T00:00:00.000Z' }),
      post('c', { createdAt: '2026-08-20T00:00:00.000Z' }),
    ];
    const out = toScoreInput(posts, judged({ a: [true, 1], b: [true, 1], c: [true, 1] }));
    // Two posts in one week then a gap: the streak is one week, not two.
    expect(out.longestStreakWeeks).toBe(1);
  });

  it('treats a post the model never judged as not technology', () => {
    const out = toScoreInput([post('a')], judged({}));
    expect(out.relevantCount).toBe(0);
  });

  it('counts consecutive weeks as a streak', () => {
    const posts = [
      post('a', { createdAt: '2026-08-03T00:00:00.000Z' }),
      post('b', { createdAt: '2026-08-10T00:00:00.000Z' }),
      post('c', { createdAt: '2026-08-17T00:00:00.000Z' }),
    ];
    const out = toScoreInput(posts, judged({ a: [true, 1], b: [true, 1], c: [true, 1] }));
    expect(out.longestStreakWeeks).toBe(3);
  });
});
