import { describe, expect, it } from 'vitest';

import { RUBRIC, renderPosts } from '../../src/lib/llm/prompt';
import { TAXONOMY, TOPIC_IDS } from '../../src/lib/llm/taxonomy';
import { reconcile } from '../../src/lib/llm/schema';
import type { Post } from '../../src/lib/providers/types';

const post = (over: Partial<Post>): Post => ({
  id: '1', text: 'text', createdAt: '2026-08-01T00:00:00.000Z',
  views: 12345, replies: 7, reposts: 3, likes: 99,
  isReply: false, isRepost: false, isQuote: false,
  ...over,
});

describe('taxonomy', () => {
  it('has unique ids', () => {
    expect(new Set(TOPIC_IDS).size).toBe(TOPIC_IDS.length);
  });

  it('gives every topic both boundary cases, because the boundary is where a classifier needs help', () => {
    for (const t of TAXONOMY) {
      expect(t.definition.length, t.id).toBeGreaterThan(20);
      expect(t.counts.length, t.id).toBeGreaterThan(20);
      expect(t.doesNotCount.length, t.id).toBeGreaterThan(20);
    }
  });
});

describe('RUBRIC', () => {
  it('names every topic id, so the model can actually return them', () => {
    for (const id of TOPIC_IDS) expect(RUBRIC).toContain(id);
  });

  it('contains nothing volatile, or the cache prefix would break every request', () => {
    // A date, a time, or a handle in here means a fresh prefix per request and no cache hits.
    expect(RUBRIC).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(RUBRIC).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(RUBRIC).not.toContain('@');
  });

  it('is stable across reads', () => {
    expect(RUBRIC).toBe(RUBRIC);
  });

  it('tells the model it does not do arithmetic', () => {
    expect(RUBRIC).toMatch(/never compute a score/i);
  });
});

describe('renderPosts', () => {
  it('sends text and id only — engagement must not leak into a judgement about substance', () => {
    const rendered = renderPosts([post({ id: '42', text: 'a claim about consensus' })]);
    expect(rendered).toContain('42');
    expect(rendered).toContain('a claim about consensus');
    for (const n of ['12345', '99', '7', '3']) expect(rendered).not.toContain(n);
  });

  it('preserves order, so the same posts render identically', () => {
    const posts = [post({ id: 'a' }), post({ id: 'b' })];
    expect(renderPosts(posts)).toBe(renderPosts(posts));
    expect(renderPosts(posts).indexOf('"a"')).toBeLessThan(renderPosts(posts).indexOf('"b"'));
  });
});

describe('reconcile', () => {
  const asked = ['a', 'b', 'c'];

  it('drops topics that are not in the taxonomy', () => {
    const out = reconcile(
      { posts: [{ id: 'a', isTechnology: true, explanationRating: 0.5, topics: ['consensus', 'astrology'] }],
        powerTopics: ['consensus', 'astrology'], narrative: 'n' },
      asked,
    );
    expect(out.posts[0].topics).toEqual(['consensus']);
    expect(out.powerTopics).toEqual(['consensus']);
  });

  it('ignores judgements for posts we never sent', () => {
    const out = reconcile(
      { posts: [{ id: 'zzz', isTechnology: true, explanationRating: 1, topics: [] }],
        powerTopics: [], narrative: 'n' },
      asked,
    );
    expect(out.posts.map((p) => p.id)).toEqual(asked);
    expect(out.posts.every((p) => !p.isTechnology)).toBe(true);
  });

  it('treats a post the model skipped as not-technology rather than losing it', () => {
    const out = reconcile(
      { posts: [{ id: 'a', isTechnology: true, explanationRating: 0.8, topics: [] }],
        powerTopics: [], narrative: 'n' },
      asked,
    );
    expect(out.posts).toHaveLength(3);
    expect(out.posts.find((p) => p.id === 'c')).toMatchObject({ isTechnology: false, explanationRating: 0 });
  });

  it('clamps a rating outside 0..1', () => {
    const out = reconcile(
      { posts: [{ id: 'a', isTechnology: true, explanationRating: 4.2, topics: [] }],
        powerTopics: [], narrative: 'n' },
      asked,
    );
    expect(out.posts[0].explanationRating).toBe(1);
  });

  it('caps power topics at five', () => {
    const out = reconcile(
      { posts: [], powerTopics: TOPIC_IDS.slice(0, 9) as string[], narrative: 'n' },
      asked,
    );
    expect(out.powerTopics).toHaveLength(5);
  });

  it('keeps the first judgement when the model repeats a post id', () => {
    const out = reconcile(
      { posts: [
          { id: 'a', isTechnology: true, explanationRating: 0.9, topics: [] },
          { id: 'a', isTechnology: false, explanationRating: 0.1, topics: [] },
        ], powerTopics: [], narrative: 'n' },
      asked,
    );
    expect(out.posts.find((p) => p.id === 'a')?.explanationRating).toBe(0.9);
  });
});
