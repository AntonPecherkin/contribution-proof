import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { brightDataProvider } from '../../src/lib/providers/brightdata';
import { looksLikeReply, toPost } from '../../src/lib/providers/mapping';

import rich from '../../fixtures/brightdata/rich.json';
import noPosts from '../../fixtures/brightdata/no_posts.json';
import empty from '../../fixtures/brightdata/empty.json';
import notFound from '../../fixtures/brightdata/not_found.json';
import privateAcct from '../../fixtures/brightdata/private.json';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.BRIGHTDATA_API_KEY = 'test-key';
  process.env.BRIGHTDATA_X_PROFILE_DATASET = 'gd_test';
  process.env.BRIGHTDATA_BASE_URL = 'https://provider.test';
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BRIGHTDATA_API_KEY;
  delete process.env.BRIGHTDATA_X_PROFILE_DATASET;
});

/** progress -> snapshot, the two calls resolveSnapshot makes when collection is done. */
const readyWith = (rows: unknown) => {
  fetchMock
    .mockResolvedValueOnce(json({ status: 'ready' }))
    .mockResolvedValueOnce(json(rows));
};

describe('fetchRecentPosts', () => {
  it('hands back a snapshot id rather than data, because collection is asynchronous', async () => {
    fetchMock.mockResolvedValueOnce(json({ snapshot_id: 'sd_abc' }));
    await expect(brightDataProvider.fetchRecentPosts('devbuilder', 20)).resolves.toEqual({
      ok: false, pending: true, snapshotId: 'sd_abc',
    });
  });

  it('reports a missing key as our problem, not a bad handle', async () => {
    delete process.env.BRIGHTDATA_API_KEY;
    await expect(brightDataProvider.fetchRecentPosts('devbuilder', 20)).resolves.toEqual({
      ok: false, errorClass: 'provider',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries a 500 exactly once, then gives up', async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, { status: 500 }))
      .mockResolvedValueOnce(json({}, { status: 500 }));
    await expect(brightDataProvider.fetchRecentPosts('devbuilder', 20)).resolves.toEqual({
      ok: false, errorClass: 'provider',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('resolveSnapshot', () => {
  it('hands the ticket back while collection is still running', async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 'running' }));
    await expect(brightDataProvider.resolveSnapshot('sd_abc')).resolves.toEqual({
      ok: false, pending: true, snapshotId: 'sd_abc',
    });
    // One progress check per call. The caller polls; the provider does not loop.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps a completed snapshot into posts', async () => {
    readyWith(rich);
    const result = await brightDataProvider.resolveSnapshot('sd_abc');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.posts.length).toBeGreaterThan(10);
    expect(result.posts.every((p) => p.createdAt.endsWith('Z'))).toBe(true);
  });

  it('drops the post that carries only a URL and a view count', async () => {
    readyWith(rich);
    const result = await brightDataProvider.resolveSnapshot('sd_abc');
    if (!result.ok) throw new Error('expected success');
    // rich.json's first entry has null text and null date: no evidence, so not counted.
    expect(result.posts.length).toBe((rich as { posts: unknown[] }[])[0].posts.length - 1);
  });

  it('keeps an unreported view count as null, never zero', async () => {
    readyWith(rich);
    const result = await brightDataProvider.resolveSnapshot('sd_abc');
    if (!result.ok) throw new Error('expected success');
    expect(result.posts.some((p) => p.views === null)).toBe(true);
    expect(result.posts.some((p) => p.views === 0)).toBe(false);
  });

  it('returns no_posts_available when the profile is fine but posts is null', async () => {
    // The account exists and reports 97 posts. This is neither empty nor not-found.
    readyWith(noPosts);
    await expect(brightDataProvider.resolveSnapshot('sd_abc')).resolves.toEqual({
      ok: false, errorClass: 'no_posts_available',
    });
  });

  it('distinguishes an account with no posts from one we could not read', async () => {
    readyWith(empty);
    await expect(brightDataProvider.resolveSnapshot('sd_abc')).resolves.toEqual({
      ok: false, errorClass: 'empty',
    });
  });

  it('maps a dead page to invalid_handle', async () => {
    readyWith(notFound);
    await expect(brightDataProvider.resolveSnapshot('sd_abc')).resolves.toEqual({
      ok: false, errorClass: 'invalid_handle',
    });
  });

  it('maps a protected account to private', async () => {
    readyWith(privateAcct);
    await expect(brightDataProvider.resolveSnapshot('sd_abc')).resolves.toEqual({
      ok: false, errorClass: 'private',
    });
  });

  it('treats an unparseable body as a provider failure rather than throwing', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ready' }))
      .mockResolvedValueOnce(new Response('{"posts":[', { status: 200 }));
    await expect(brightDataProvider.resolveSnapshot('sd_abc')).resolves.toEqual({
      ok: false, errorClass: 'provider',
    });
  });

  it('treats a failed snapshot as a provider failure', async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 'failed' }));
    await expect(brightDataProvider.resolveSnapshot('sd_abc')).resolves.toEqual({
      ok: false, errorClass: 'provider',
    });
  });
});

describe('post mapping', () => {
  it('recovers the id from the URL when post_id is null', () => {
    const p = toPost({
      post_id: null,
      post_url: 'https://x.com/devbuilder/status/1840000000000123',
      description: 'text', date_posted: '2026-08-01T00:00:00.000Z',
    });
    expect(p?.id).toBe('1840000000000123');
  });

  it('drops a post with no usable timestamp', () => {
    expect(toPost({ post_id: '1', description: 'text', date_posted: 'not-a-date' })).toBeNull();
  });

  it('treats a leading mention as a reply and ordinary text as not', () => {
    expect(looksLikeReply('@someone that depends on batching')).toBe(true);
    expect(looksLikeReply('  @someone yes')).toBe(true);
    expect(looksLikeReply('Shipped a small thing today')).toBe(false);
    expect(looksLikeReply('email me at @ the usual place')).toBe(false);
  });
});

describe('ordering', () => {
  it('returns the newest posts, because the provider does not sort', async () => {
    // Measured: the raw array spans years in no useful order. Without a sort, "the latest
    // 20 posts" would silently mean "20 arbitrary posts since 2018".
    const shuffled = [{
      id: 'devbuilder', profile_name: 'Dev', followers: 1,
      posts: [
        { post_id: '1', description: 'old', date_posted: '2019-01-01T00:00:00.000Z' },
        { post_id: '2', description: 'newest', date_posted: '2026-08-01T00:00:00.000Z' },
        { post_id: '3', description: 'middle', date_posted: '2023-05-05T00:00:00.000Z' },
      ],
    }];
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ready' }))
      .mockResolvedValueOnce(json(shuffled));
    const r = await brightDataProvider.resolveSnapshot('sd_abc');
    if (!r.ok) throw new Error('expected success');
    expect(r.posts.map((p) => p.text)).toEqual(['newest', 'middle', 'old']);
  });
});
