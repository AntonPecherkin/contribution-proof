import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../src/lib/db', () => ({
  getDb: () => ({ from: db.from }),
}));

import { clearSettingsCache, getSettings } from '../src/lib/settings';

const defaults = {
  analysisEnabled: true,
  turnstileEnabled: false,
  primaryProvider: 'twitterapi',
  demoMode: false,
  maxAnalysesPerEvent: 500,
  perIpHourlyCap: 10,
};

function rows(values: Record<string, unknown>) {
  return Object.entries(values).map(([key, value]) => ({ key, value }));
}

beforeEach(() => {
  clearSettingsCache();
  vi.useRealTimers();
  db.from.mockReset();
  db.select.mockReset();
  db.from.mockReturnValue({ select: db.select });
});

describe('getSettings', () => {
  it('parses a well-formed settings table', async () => {
    db.select.mockResolvedValue({
      data: rows({
        analysis_enabled: false,
        turnstile_enabled: true,
        primary_provider: 'mock',
        demo_mode: true,
        max_analyses_per_event: 250,
        per_ip_hourly_cap: 4,
      }),
      error: null,
    });

    await expect(getSettings()).resolves.toEqual({
      analysisEnabled: false,
      turnstileEnabled: true,
      primaryProvider: 'mock',
      demoMode: true,
      maxAnalysesPerEvent: 250,
      perIpHourlyCap: 4,
    });
    expect(db.from).toHaveBeenCalledWith('settings');
    expect(db.select).toHaveBeenCalledWith('key,value');
  });

  it('returns defaults when the settings table is unavailable', async () => {
    db.select.mockResolvedValue({ data: null, error: { message: 'missing table' } });

    await expect(getSettings()).resolves.toEqual(defaults);
  });

  it('coerces supported values and falls back per key for garbage', async () => {
    db.select.mockResolvedValue({
      data: rows({
        analysis_enabled: 'TRUE',
        turnstile_enabled: 1,
        primary_provider: 'not-a-provider',
        demo_mode: 'false',
        max_analyses_per_event: 'garbage',
        per_ip_hourly_cap: '7',
      }),
      error: null,
    });

    await expect(getSettings()).resolves.toEqual({
      ...defaults,
      turnstileEnabled: true,
      perIpHourlyCap: 7,
    });
  });

  it('caches for 30 seconds, then queries again', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T10:15:00.000Z'));
    db.select
      .mockResolvedValueOnce({ data: rows({ demo_mode: false }), error: null })
      .mockResolvedValueOnce({ data: rows({ demo_mode: true }), error: null });

    expect((await getSettings()).demoMode).toBe(false);
    expect((await getSettings()).demoMode).toBe(false);
    expect(db.select).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);

    expect((await getSettings()).demoMode).toBe(true);
    expect(db.select).toHaveBeenCalledTimes(2);
  });
});
