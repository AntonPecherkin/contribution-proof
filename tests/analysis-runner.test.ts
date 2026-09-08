import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ from: vi.fn() }));
const provider = vi.hoisted(() => ({ name: 'mock', fetchRecentPosts: vi.fn(), resolveSnapshot: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));
vi.mock('../src/lib/db', () => ({ getDb: () => db }));
vi.mock('../src/lib/providers', () => ({ getProvider: async () => provider }));
vi.mock('../src/lib/analytics', () => ({ track: vi.fn() }));

import { runAnalysis } from '../src/lib/analysis-runner';
import rich from '../fixtures/brightdata/rich.json';
import noPosts from '../fixtures/brightdata/no_posts.json';
import { mapProfileRow, type RawProfile } from '../src/lib/providers/mapping';

/**
 * These assert what actually reaches the database.
 *
 * views_total shipped unwritten because every other test mocks the client and none looked at
 * the payload. The room board sums that column, so it would have read "Not available" all
 * day while each result page showed a real number - invisible to 119 passing tests and
 * caught only by connecting to a real database.
 *
 * The board reads these columns, not the jsonb blob, so each one is pinned by name.
 */

/** Captures the object passed to .update() while satisfying the query builder chain. */
const updates: Record<string, unknown>[] = [];
const chainFor = (row: unknown) => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data: row }));
  chain.update = vi.fn((payload: Record<string, unknown>) => {
    updates.push(payload);
    return chain;
  });
  return chain;
};

beforeEach(() => {
  updates.length = 0;
  db.from.mockReset();
  provider.fetchRecentPosts.mockReset();
  provider.resolveSnapshot.mockReset();
});

const queuedRow = {
  id: 'a1', event_id: 'e1', x_handle_normalized: 'devbuilder',
  status: 'queued', provider_snapshot_id: null, started_at: new Date().toISOString(),
};

const completionWrite = () => updates.find((u) => u.status === 'complete');

describe('what a completed analysis writes', () => {
  it('sets every column the board reads, not just the result blob', async () => {
    db.from.mockImplementation(() => chainFor(queuedRow));
    provider.fetchRecentPosts.mockResolvedValue(mapProfileRow((rich as RawProfile[])[0], 20));

    await runAnalysis('a1');

    const write = completionWrite();
    expect(write, 'no completion write happened').toBeDefined();
    // Named individually: the board aggregates over these columns and a missing one is
    // silent, showing "Not available" beside a result page that has the number.
    for (const column of [
      'score_total', 'eligible_post_count', 'evidence_band',
      'posts_technology', 'views_total', 'topics',
      'result_kind', 'result', 'cache_expires_at', 'completed_at',
    ]) {
      expect(write, `completion write is missing ${column}`).toHaveProperty(column);
    }
  });

  it('writes a views total that matches the result the participant sees', async () => {
    db.from.mockImplementation(() => chainFor(queuedRow));
    provider.fetchRecentPosts.mockResolvedValue(mapProfileRow((rich as RawProfile[])[0], 20));

    await runAnalysis('a1');

    const write = completionWrite()!;
    const shown = (write.result as { stats: { totalViews: number | null } }).stats.totalViews;
    expect(write.views_total).toBe(shown);
  });

  it('completes a profile-only account rather than failing it', async () => {
    db.from.mockImplementation(() => chainFor(queuedRow));
    provider.fetchRecentPosts.mockResolvedValue(mapProfileRow((noPosts as RawProfile[])[0], 20));

    await runAnalysis('a1');

    const write = completionWrite();
    expect(write?.result_kind).toBe('profile');
    expect(write?.score_total).toBeGreaterThan(0);
    // No posts means no post-derived aggregates; the board must not count zeros as data.
    expect(write?.views_total).toBeNull();
    expect(write?.posts_technology).toBeNull();
  });

  it('never fails an account whose posts we could not read, even with no profile', async () => {
    // A third of accounts land here. It is our limitation, not theirs, so it must always
    // produce a result - and it must not depend on the provider having returned a profile.
    db.from.mockImplementation(() => chainFor(queuedRow));
    provider.fetchRecentPosts.mockResolvedValue({ ok: false, errorClass: 'no_posts_available' });

    await runAnalysis('a1');

    const write = completionWrite();
    expect(write, 'no_posts_available reached the failure path').toBeDefined();
    expect(write?.status).toBe('complete');
    expect(write?.result_kind).toBe('profile');
    expect(updates.some((u) => u.status === 'failed')).toBe(false);
  });

  it('records the snapshot id when collection goes asynchronous', async () => {
    db.from.mockImplementation(() => chainFor(queuedRow));
    provider.fetchRecentPosts.mockResolvedValue({ ok: false, pending: true, snapshotId: 'sd_x' });

    await runAnalysis('a1');

    expect(updates.some((u) => u.provider_snapshot_id === 'sd_x')).toBe(true);
    expect(completionWrite()).toBeUndefined();
  });

  it('does nothing to a row that already finished', async () => {
    db.from.mockImplementation(() => chainFor({ ...queuedRow, status: 'complete' }));
    await runAnalysis('a1');
    expect(updates).toHaveLength(0);
    expect(provider.fetchRecentPosts).not.toHaveBeenCalled();
  });
});
