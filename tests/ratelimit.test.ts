import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type RpcArgs = {
  p_event_bucket: string;
  p_ip_bucket: string;
  p_handle_bucket: string;
  p_event_cap: number;
  p_ip_cap: number;
  p_handle_cap: number;
  p_window_start: string;
};

const dependencies = vi.hoisted(() => ({
  getSettings: vi.fn<() => Promise<{
    analysisEnabled: boolean;
    turnstileEnabled: boolean;
    primaryProvider: 'twitterapi' | 'mock';
    demoMode: boolean;
    maxAnalysesPerEvent: number;
    perIpHourlyCap: number;
  }>>(),
  rpc: vi.fn<(name: string, args: RpcArgs) => Promise<{
    data: string | null;
    error: { message: string } | null;
  }>>(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../src/lib/db', () => ({
  getDb: () => ({ rpc: dependencies.rpc }),
}));
vi.mock('../src/lib/settings', () => ({
  getSettings: dependencies.getSettings,
}));

import { checkAndIncrement } from '../src/lib/ratelimit';

const counts = new Map<string, number>();

function installAtomicRpcStub(): void {
  dependencies.rpc.mockImplementation(async (name, args) => {
    expect(name).toBe('check_and_increment_rate_limits');

    const checks = [
      { bucket: args.p_event_bucket, cap: args.p_event_cap, reason: 'event' },
      { bucket: args.p_ip_bucket, cap: args.p_ip_cap, reason: 'ip' },
      { bucket: args.p_handle_bucket, cap: args.p_handle_cap, reason: 'handle' },
    ] as const;

    const breach = checks.find(({ bucket, cap }) => (counts.get(bucket) ?? 0) >= cap);
    if (breach) return { data: breach.reason, error: null };

    for (const { bucket } of checks) counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    return { data: 'allowed', error: null };
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-07T10:15:00.000Z'));
  counts.clear();
  dependencies.getSettings.mockReset();
  dependencies.rpc.mockReset();
  dependencies.getSettings.mockResolvedValue({
    analysisEnabled: true,
    turnstileEnabled: false,
    primaryProvider: 'twitterapi',
    demoMode: false,
    maxAnalysesPerEvent: 5,
    perIpHourlyCap: 2,
  });
  installAtomicRpcStub();
});

describe('checkAndIncrement', () => {
  it('allows requests below every cap and increments all buckets', async () => {
    await expect(checkAndIncrement({
      ip: '203.0.113.8', handle: 'alice', eventId: 'event-1',
    })).resolves.toEqual({ allowed: true });

    expect([...counts.values()]).toEqual([1, 1, 1]);
  });

  it.each([
    ['event', 'event:event-1'],
    ['ip', `ip:${createHash('sha256').update('203.0.113.8').digest('hex')}:2026-09-07T10`],
    ['handle', 'handle:alice:2026-09-07T10'],
  ] as const)('denies at the %s cap and reports its reason', async (reason, bucket) => {
    counts.set(bucket, reason === 'event' ? 5 : 2);

    await expect(checkAndIncrement({
      ip: '203.0.113.8', handle: 'alice', eventId: 'event-1',
    })).resolves.toEqual({ allowed: false, reason });
  });

  it('does not increment any bucket when a later check is denied', async () => {
    counts.set('event:event-1', 1);
    counts.set('handle:alice:2026-09-07T10', 2);

    await checkAndIncrement({ ip: '203.0.113.8', handle: 'alice', eventId: 'event-1' });

    expect(counts.get('event:event-1')).toBe(1);
    expect(counts.get('handle:alice:2026-09-07T10')).toBe(2);
  });

  it('rolls hourly buckets over at the hour boundary', async () => {
    await checkAndIncrement({ ip: '203.0.113.8', handle: 'alice', eventId: 'event-1' });
    vi.setSystemTime(new Date('2026-09-07T11:00:00.000Z'));
    await checkAndIncrement({ ip: '203.0.113.8', handle: 'alice', eventId: 'event-1' });

    const firstArgs = dependencies.rpc.mock.calls[0]?.[1];
    const secondArgs = dependencies.rpc.mock.calls[1]?.[1];
    expect(firstArgs?.p_ip_bucket).toContain('2026-09-07T10');
    expect(secondArgs?.p_ip_bucket).toContain('2026-09-07T11');
    expect(firstArgs?.p_handle_bucket).not.toBe(secondArgs?.p_handle_bucket);
  });

  it('never stores the raw IP address in a bucket', async () => {
    await checkAndIncrement({
      ip: '203.0.113.8', handle: 'alice', eventId: 'event-1',
    });

    const args = dependencies.rpc.mock.calls[0]?.[1];
    expect(args?.p_ip_bucket).not.toContain('203.0.113.8');
    expect(args?.p_ip_bucket).toContain(
      createHash('sha256').update('203.0.113.8').digest('hex'),
    );
  });

  it('fails closed when the database is unreachable, without claiming a cap was hit', async () => {
    dependencies.rpc.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(checkAndIncrement({
      ip: '203.0.113.8', handle: 'alice', eventId: 'event-1',
    })).resolves.toEqual({ allowed: false, reason: 'unavailable' });
  });
});
