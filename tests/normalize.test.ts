import { describe, expect, it } from 'vitest';
import { normalizeHandle, normalizeEmail, isEligible } from '../src/lib/normalize';
import type { Post } from '../src/lib/providers/types';

/**
 * SKIPPED until task C2 implements it. Un-skip as your first step, watch it fail, then
 * make it pass. Do not change an assertion - if you believe one is wrong, say so in the
 * PR and leave it.
 */
describe('normalizeHandle', () => {
  it('accepts every way a person might give the same account', () => {
    for (const input of [
      'jack', '@jack', '@JACK', '  jack  ', 'Jack',
      'x.com/jack', 'https://x.com/jack', 'https://www.x.com/jack',
      'twitter.com/jack', 'https://twitter.com/jack',
      'https://x.com/jack?s=21', 'https://x.com/jack/status/1234567890',
    ]) {
      expect(normalizeHandle(input), `input: ${input}`).toBe('jack');
    }
  });

  it('rejects input with no extractable handle', () => {
    for (const input of ['', '   ', '@', 'https://x.com/', 'https://example.com']) {
      expect(normalizeHandle(input), `input: ${input}`).toBeNull();
    }
  });

  it("rejects handles that break X's own rules", () => {
    expect(normalizeHandle('a'.repeat(16))).toBeNull();   // over 15 characters
    expect(normalizeHandle('has-a-dash')).toBeNull();     // dashes are not allowed
    expect(normalizeHandle('has.a.dot')).toBeNull();
  });

  it('accepts the characters X does allow', () => {
    expect(normalizeHandle('under_score_9')).toBe('under_score_9');
    expect(normalizeHandle('a')).toBe('a');
    expect(normalizeHandle('a'.repeat(15))).toBe('a'.repeat(15));
  });

  it('does not accept a Unicode lookalike as the ASCII handle', () => {
    // U+0430 CYRILLIC SMALL LETTER A renders identically to 'a' but is a different
    // account. Silently accepting it analyzes the wrong person, or nobody.
    const cyrillic = 'j\u0430ck';
    expect(cyrillic).not.toBe('jack');
    expect(normalizeHandle(cyrillic)).not.toBe('jack');
  });

  it("rejects X's own pages pasted from the address bar", () => {
    // Someone at a booth pastes whatever their browser shows. None of these is a profile,
    // and each would otherwise become a plausible-looking handle.
    for (const input of [
      'x.com/home', 'x.com/explore', 'x.com/settings', 'x.com/messages',
      'x.com/search?q=ai', 'x.com/intent/tweet?text=hi',
      'https://x.com/i/web/status/1840000000000000', 'x.com/i/lists/123',
    ]) {
      expect(normalizeHandle(input), `input: ${input}`).toBeNull();
    }
  });

  it('still accepts a reserved word typed as a bare handle', () => {
    // The reservation belongs to the URL path, not to the namespace of names people have.
    expect(normalizeHandle('home')).toBe('home');
    expect(normalizeHandle('@search')).toBe('search');
  });

  it('never throws, whatever it is handed', () => {
    for (const input of ['x', ' ', '../../etc/passwd', '<script>', 'a'.repeat(5000)]) {
      expect(() => normalizeHandle(input)).not.toThrow();
    }
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
  });

  it('rejects malformed addresses', () => {
    for (const input of ['', 'person', 'person@', '@example.com', 'a b@example.com']) {
      expect(normalizeEmail(input), `input: ${input}`).toBeNull();
    }
  });

  it('keeps dots and plus tags - two different addresses are two different leads', () => {
    // Silently merging people is worse than storing a duplicate.
    expect(normalizeEmail('first.last+event@gmail.com')).toBe('first.last+event@gmail.com');
    expect(normalizeEmail('firstlast@gmail.com')).not.toBe(normalizeEmail('first.last@gmail.com'));
  });
});

describe('isEligible', () => {
  const post = (over: Partial<Post>): Post => ({
    id: '1', text: 't', createdAt: '2026-08-01T00:00:00.000Z',
    views: 1, replies: 0, reposts: 0, likes: 0,
    isReply: false, isRepost: false, isQuote: false,
    ...over,
  });

  it('counts original posts', () => {
    expect(isEligible(post({}))).toBe(true);
  });

  it('counts quote posts - adding your own commentary is a contribution', () => {
    expect(isEligible(post({ isQuote: true }))).toBe(true);
  });

  it('excludes replies', () => {
    expect(isEligible(post({ isReply: true }))).toBe(false);
  });

  it('excludes reposts - amplifying is not authoring', () => {
    expect(isEligible(post({ isRepost: true }))).toBe(false);
  });

  it('excludes a repost even when it is also marked a quote', () => {
    expect(isEligible(post({ isRepost: true, isQuote: true }))).toBe(false);
  });
});
