import { describe, expect, it } from 'vitest';

import { buildBoard, type CompletedAnalysis } from '../src/lib/board';

const row = (over: Partial<CompletedAnalysis>): CompletedAnalysis => ({
  handle: 'someone', score: 500, kind: 'analysis', technologyPosts: 10,
  views: 1000, topics: ['scaling'], completedAt: '2026-09-07T10:00:00.000Z',
  optedIn: true, ...over,
});

describe('buildBoard', () => {
  it('never serializes a handle that did not opt in', () => {
    // The privacy boundary. This runs on a projector in a public room.
    const payload = buildBoard([
      row({ handle: 'consented', optedIn: true }),
      row({ handle: 'private-person', optedIn: false, score: 990 }),
    ]);
    const json = JSON.stringify(payload);
    expect(json).not.toContain('private-person');
    expect(json).toContain('consented');
  });

  it('still counts a non-consenting account in the aggregates', () => {
    // A count is not an identity: the room total should be true.
    const payload = buildBoard([
      row({ handle: 'a', optedIn: true, technologyPosts: 5 }),
      row({ handle: 'b', optedIn: false, technologyPosts: 7 }),
    ]);
    expect(payload.analysed).toBe(2);
    expect(payload.technologyPosts).toBe(12);
  });

  it('counts one analysis per handle, so a duplicate cannot inflate the room', () => {
    const payload = buildBoard([
      row({ handle: 'same', technologyPosts: 9 }),
      row({ handle: 'same', technologyPosts: 9 }),
    ]);
    expect(payload.analysed).toBe(1);
    expect(payload.technologyPosts).toBe(9);
  });

  it('shows profile results in Just In but never in Top Today', () => {
    // Both belong on the board; only one belongs in a ranking.
    const payload = buildBoard([
      row({ handle: 'profileperson', kind: 'profile', score: 54, completedAt: '2026-09-07T12:00:00.000Z' }),
      row({ handle: 'scoredperson', kind: 'analysis', score: 700, completedAt: '2026-09-07T09:00:00.000Z' }),
    ]);
    expect(payload.justIn.map((r) => r.handle)).toContain('profileperson');
    expect(payload.topToday.map((r) => r.handle)).not.toContain('profileperson');
    expect(payload.topToday.map((r) => r.handle)).toContain('scoredperson');
  });

  it('orders Just In by most recent', () => {
    const payload = buildBoard([
      row({ handle: 'older', completedAt: '2026-09-07T08:00:00.000Z' }),
      row({ handle: 'newest', completedAt: '2026-09-07T14:00:00.000Z' }),
    ]);
    expect(payload.justIn[0].handle).toBe('newest');
  });

  it('reports views as null when nobody reported any, rather than zero', () => {
    expect(buildBoard([row({ views: null })]).totalViews).toBeNull();
    expect(buildBoard([row({ views: 0 })]).totalViews).toBe(0);
  });

  it('labels room topics for reading rather than emitting ids', () => {
    const payload = buildBoard([row({ topics: ['creator-economy'] })]);
    expect(payload.roomTopics[0]).toBe('Creator economy and distribution');
  });

  it('produces an empty but valid board before anyone has scanned', () => {
    const payload = buildBoard([]);
    expect(payload).toMatchObject({ analysed: 0, technologyPosts: 0, totalViews: null, justIn: [], topToday: [] });
  });
});
