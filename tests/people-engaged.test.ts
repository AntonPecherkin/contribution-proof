import { describe, expect, it } from 'vitest';

import { relevantPosts } from '../src/lib/analysis';
import { daysBuilding, peopleEngagedInTech } from '../src/lib/stats';
import type { Post } from '../src/lib/providers/types';

const post = (id: string, over: Partial<Post> = {}): Post => ({
  id, text: 'a post long enough to be eligible for analysis here', createdAt: '2026-08-05T00:00:00.000Z',
  views: null, replies: 0, reposts: 0, likes: 0,
  isReply: false, isRepost: false, isQuote: false,
  ...over,
});

const judged = (ids: Record<string, boolean>) => ({
  posts: Object.entries(ids).map(([id, isTechnology]) => ({
    id, isTechnology, explanationRating: 0, topics: [], matched: [],
  })),
  powerTopics: [],
});

describe('relevantPosts', () => {
  it('keeps only posts the classifier marked technology', () => {
    const posts = [post('a'), post('b'), post('c')];
    const kept = relevantPosts(posts, judged({ a: true, b: false, c: true }));
    expect(kept.map((p) => p.id)).toEqual(['a', 'c']);
  });
});

describe('peopleEngagedInTech', () => {
  it('sums likes, reposts and replies across technology posts only', () => {
    const posts = [
      post('tech', { likes: 10, reposts: 3, replies: 2 }),
      post('other', { likes: 900, reposts: 900, replies: 900 }),
    ];
    expect(peopleEngagedInTech(posts, judged({ tech: true, other: false }))).toBe(15);
  });

  it('is null, not zero, when the provider reported no engagement at all', () => {
    const posts = [post('tech', { likes: null, reposts: null, replies: null })];
    expect(peopleEngagedInTech(posts, judged({ tech: true }))).toBeNull();
  });

  it('distinguishes a genuine zero from an absent metric', () => {
    const posts = [post('tech', { likes: 0, reposts: 0, replies: 0 })];
    expect(peopleEngagedInTech(posts, judged({ tech: true }))).toBe(0);
  });

  it('sums the metrics that are present and ignores the absent ones', () => {
    const posts = [post('tech', { likes: 7, reposts: null, replies: 5 })];
    expect(peopleEngagedInTech(posts, judged({ tech: true }))).toBe(12);
  });

  it('is null when no post is a technology post', () => {
    const posts = [post('other', { likes: 50, reposts: 10, replies: 4 })];
    expect(peopleEngagedInTech(posts, judged({ other: false }))).toBeNull();
  });
});

describe('daysBuilding', () => {
  it('counts whole days since the account joined', () => {
    const joined = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysBuilding(joined)).toBe(100);
  });

  it('is null when the provider omitted the join date', () => {
    expect(daysBuilding(null)).toBeNull();
  });

  it('never returns a negative number for a join date in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(daysBuilding(future)).toBe(0);
  });

  it('is null for an unparseable join date', () => {
    expect(daysBuilding('not-a-date')).toBeNull();
  });
});
