import { describe, expect, it } from 'vitest';

import { profileSignal } from '../src/lib/signal';
import type { ProfileSummary } from '../src/lib/providers/types';

const profile = (over: Partial<ProfileSummary> = {}): ProfileSummary => ({
  handle: 'builder', displayName: 'Builder', bio: null,
  followers: 200, following: 100, postsCount: 97,
  joinedAt: '2020-11-19T09:50:59.247Z', isVerified: true,
  location: null, externalLink: null,
  ...over,
});

const NOW = new Date('2026-09-07T00:00:00.000Z');

describe('profileSignal', () => {
  it('reads topics from the bio with the same taxonomy the posts use', () => {
    const r = profileSignal(
      profile({ bio: 'Building the AI content layer for web3. Rust, smart contracts, zk proofs.' }),
      NOW,
    );
    expect(r.topics.length).toBeGreaterThan(0);
    expect(r.matchedWords.length).toBeGreaterThan(0);
  });

  it('copes with no bio at all', () => {
    const r = profileSignal(profile({ bio: null }), NOW);
    expect(r.topics).toEqual([]);
    expect(r.matchedWords).toEqual([]);
  });

  it('reports account age in years', () => {
    expect(profileSignal(profile(), NOW).accountAgeYears).toBeCloseTo(5.8, 1);
  });

  it('does not report a posts-per-year figure for a brand new account', () => {
    // Dividing 97 posts by a few days of age would report thousands per year.
    const r = profileSignal(profile({ joinedAt: '2026-09-01T00:00:00.000Z' }), NOW);
    expect(r.postsPerYear).toBeNull();
  });

  it('computes posts per year for an established account', () => {
    expect(profileSignal(profile(), NOW).postsPerYear).toBe(17);
  });

  it('computes a follower ratio, and skips it when nobody is followed', () => {
    expect(profileSignal(profile(), NOW).followerRatio).toBe(2);
    expect(profileSignal(profile({ following: 0 }), NOW).followerRatio).toBeNull();
  });

  it('survives a profile with nothing but a handle', () => {
    const bare = profile({ followers: null, following: null, postsCount: null, joinedAt: null });
    const r = profileSignal(bare, NOW);
    expect(r.accountAgeYears).toBeNull();
    expect(r.postsPerYear).toBeNull();
    expect(r.followerRatio).toBeNull();
  });

  it('produces a score of its own, never a denominator', () => {
    const r = profileSignal(profile({ bio: 'rust, zk proofs, smart contracts' }), NOW);
    expect(r.profileScore).toBeGreaterThan(0);
    expect(r.profileScore).toBeLessThanOrEqual(100);
  });

  it('sums its visible components exactly', () => {
    const r = profileSignal(profile({ bio: 'solana rust zk' }), NOW);
    const { topics, tenure, cadence, presence } = r.components;
    expect(topics + tenure + cadence + presence).toBe(r.profileScore);
    for (const v of [topics, tenure, cadence, presence]) expect(v).toBeLessThanOrEqual(25);
  });

  it('still scores when facts are missing, rather than refusing', () => {
    // Three parts and a number beats four parts and nothing.
    const r = profileSignal(profile({ joinedAt: null, postsCount: null, bio: null }), NOW);
    expect(r.components.tenure).toBe(0);
    expect(r.components.cadence).toBe(0);
    expect(r.profileScore).toBeGreaterThan(0);
  });

  it('credits both directions of the follower ratio', () => {
    // Being followed is reach; following widely is participation. Neither is a shortfall.
    const followed = profileSignal(profile({ followers: 5000, following: 100 }), NOW);
    const following = profileSignal(profile({ followers: 100, following: 5000 }), NOW);
    expect(followed.components.presence).toBe(following.components.presence);
  });

  it('names our data source as the limit, never the person', () => {
    const r = profileSignal(profile(), NOW);
    expect(r.note).toMatch(/X did not hand them over/i);
    expect(r.note).toMatch(/nothing about your account is wrong/i);
  });

  it('gives a specific headline rather than a generic one', () => {
    expect(profileSignal(profile(), NOW).headline).toBe('Class of 2020');
  });

  it('never renders a signal as a shortfall', () => {
    // Both ends of every scale must read warmly: this account is small, follows more
    // people than follow back, and posts rarely. None of that may appear as a deficit.
    const small = profile({ followers: 12, following: 900, postsCount: 20, bio: null });
    const r = profileSignal(small, NOW);
    const words = r.signals.map((s) => `${s.label} ${s.detail}`).join(' ').toLowerCase();
    // Whole words: "low" must not match inside "follows".
    for (const bad of ['only', 'just', 'low', 'few', 'lack', 'below', 'fail', 'small', 'limited']) {
      expect(words, `signal copy contained "${bad}"`).not.toMatch(new RegExp(`\\b${bad}\\b`));
    }
    expect(r.signals.some((s) => s.id === 'curious')).toBe(true);
  });

  it('still produces signals for a profile with almost nothing on it', () => {
    const bare = profile({ followers: null, following: null, postsCount: null, joinedAt: null, isVerified: false, bio: null, externalLink: null, location: null });
    const r = profileSignal(bare, NOW);
    expect(r.headline).toBe('New around here');
    expect(r.signals).toEqual([]);
  });
});
