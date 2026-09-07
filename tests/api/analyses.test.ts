import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ from: vi.fn() }));
const afterMock = vi.hoisted(() => vi.fn());
const settings = vi.hoisted(() => ({ getSettings: vi.fn() }));
const limiter = vi.hoisted(() => ({ checkAndIncrement: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, after: afterMock };
});
vi.mock('../../src/lib/db', () => ({ getDb: () => db }));
vi.mock('../../src/lib/settings', () => settings);
vi.mock('../../src/lib/ratelimit', () => limiter);
vi.mock('../../src/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('../../src/lib/analysis-runner', () => ({ runAnalysis: vi.fn(), reviveIfStale: vi.fn() }));

import { POST } from '../../src/app/api/analyses/route';

/** Minimal chainable stand-in for the query builder, resolving to a fixed row. */
const table = (result: unknown) => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'insert']) chain[m] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data: result }));
  chain.single = vi.fn(async () => ({ data: result, error: null }));
  return chain;
};

const post = (body: unknown) =>
  POST(new Request('http://t/api/analyses', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-forwarded-for': '203.0.113.9' },
  }));

beforeEach(() => {
  settings.getSettings.mockResolvedValue({ analysisEnabled: true });
  limiter.checkAndIncrement.mockResolvedValue({ allowed: true });
  afterMock.mockReset();
  db.from.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe('POST /api/analyses', () => {
  it('refuses a handle it cannot normalize, before spending anything', async () => {
    const res = await post({ handle: 'x.com/home', consentVersion: 'v1' });
    expect(res.status).toBe(400);
    expect(db.from).not.toHaveBeenCalled();
    expect(limiter.checkAndIncrement).not.toHaveBeenCalled();
  });

  it('requires consent, because collection starts on this call', async () => {
    const res = await post({ handle: 'devbuilder' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'consent_required' });
  });

  it('returns the existing row for a duplicate handle rather than paying twice', async () => {
    db.from
      .mockReturnValueOnce(table({ id: 'event-1' }))
      .mockReturnValueOnce(table({ id: 'existing-analysis', status: 'complete' }));

    const res = await post({ handle: 'devbuilder', consentVersion: 'v1' });

    expect(await res.json()).toEqual({ id: 'existing-analysis', cached: true });
    // The warm lane must not consume rate-limit budget or start new work.
    expect(limiter.checkAndIncrement).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it('starts work after responding, so the participant is not kept waiting', async () => {
    db.from
      .mockReturnValueOnce(table({ id: 'event-1' }))
      .mockReturnValueOnce(table(null))
      .mockReturnValueOnce(table({ id: 'new-analysis' }));

    const res = await post({ handle: 'devbuilder', consentVersion: 'v1' });

    expect(await res.json()).toEqual({ id: 'new-analysis', cached: false });
    expect(afterMock).toHaveBeenCalledTimes(1);
  });

  it('reports a rate limit without starting work', async () => {
    limiter.checkAndIncrement.mockResolvedValue({ allowed: false, reason: 'ip' });
    db.from.mockReturnValueOnce(table({ id: 'event-1' })).mockReturnValueOnce(table(null));

    const res = await post({ handle: 'devbuilder', consentVersion: 'v1' });

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ reason: 'ip' });
    expect(afterMock).not.toHaveBeenCalled();
  });

  it('honours the kill switch', async () => {
    settings.getSettings.mockResolvedValue({ analysisEnabled: false });
    const res = await post({ handle: 'devbuilder', consentVersion: 'v1' });
    expect(res.status).toBe(503);
    expect(db.from).not.toHaveBeenCalled();
  });
});
