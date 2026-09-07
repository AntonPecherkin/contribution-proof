import { describe, expect, it } from 'vitest';

import { reducedResult } from '../src/lib/reduced';
import type { ProfileSummary } from '../src/lib/providers/types';

const profile = (over: Partial<ProfileSummary> = {}): ProfileSummary => ({
  handle: 'builder', displayName: 'Builder', bio: null,
  followers: 200, following: 100, postsCount: 97,
  joinedAt: '2020-11-19T09:50:59.247Z', isVerified: true,
  location: null, externalLink: null,
  ...over,
});

const NOW = new Date('2026-09-07T00:00:00.000Z');

describe('reducedResult', () => {
  it('reads topics from the bio with the same taxonomy the posts use', () => {
    const r = reducedResult(
      profile({ bio: 'Building the AI content layer for web3. Rust, smart contracts, zk proofs.' }),
      NOW,
    );
    expect(r.topics.length).toBeGreaterThan(0);
    expect(r.matchedWords.length).toBeGreaterThan(0);
  });

  it('copes with no bio at all', () => {
    const r = reducedResult(profile({ bio: null }), NOW);
    expect(r.topics).toEqual([]);
    expect(r.matchedWords).toEqual([]);
  });

  it('reports account age in years', () => {
    expect(reducedResult(profile(), NOW).accountAgeYears).toBeCloseTo(5.8, 1);
  });

  it('does not report a posts-per-year figure for a brand new account', () => {
    // Dividing 97 posts by a few days of age would report thousands per year.
    const r = reducedResult(profile({ joinedAt: '2026-09-01T00:00:00.000Z' }), NOW);
    expect(r.postsPerYear).toBeNull();
  });

  it('computes posts per year for an established account', () => {
    expect(reducedResult(profile(), NOW).postsPerYear).toBe(17);
  });

  it('computes a follower ratio, and skips it when nobody is followed', () => {
    expect(reducedResult(profile(), NOW).followerRatio).toBe(2);
    expect(reducedResult(profile({ following: 0 }), NOW).followerRatio).toBeNull();
  });

  it('survives a profile with nothing but a handle', () => {
    const bare = profile({ followers: null, following: null, postsCount: null, joinedAt: null });
    const r = reducedResult(bare, NOW);
    expect(r.accountAgeYears).toBeNull();
    expect(r.postsPerYear).toBeNull();
    expect(r.followerRatio).toBeNull();
  });

  it('carries no score, because a bio and twenty posts are not comparable', () => {
    expect(Object.keys(reducedResult(profile(), NOW))).not.toContain('score');
  });

  it('explains the limit as ours, not the account holder’s', () => {
    const r = reducedResult(profile(), NOW);
    expect(r.reason).toMatch(/our data source/i);
    expect(r.reason).not.toMatch(/you (did|failed|have not)/i);
  });
});
