import 'server-only';

import { createHash } from 'node:crypto';
import { getDb } from './db';
import { getSettings } from './settings';

export type LimitResult =
  | { allowed: true }
  /**
   * `unavailable` is not a cap breach — it means the limiter could not reach the database.
   * We still fail closed, because the request would fail downstream anyway and the provider
   * budget is worth protecting. But it must be distinguishable from a real breach: telling
   * someone the event is full when the database is down is a false statement, and the copy
   * rules in docs/SPEC.md do not allow it.
   */
  | { allowed: false; reason: 'ip' | 'handle' | 'event' | 'unavailable' };

function hourKey(now: Date): string {
  return now.toISOString().slice(0, 13);
}

function hashedIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

function denied(reason: unknown): LimitResult {
  if (reason === 'ip' || reason === 'handle' || reason === 'event') {
    return { allowed: false, reason };
  }
  return { allowed: false, reason: 'unavailable' };
}

export async function checkAndIncrement(opts: {
  ip: string;
  handle: string;
  eventId: string;
}): Promise<LimitResult> {
  const settings = await getSettings();
  const hour = hourKey(new Date());

  try {
    const { data, error } = await getDb().rpc('check_and_increment_rate_limits', {
      p_event_bucket: `event:${opts.eventId}`,
      p_ip_bucket: `ip:${hashedIp(opts.ip)}:${hour}`,
      p_handle_bucket: `handle:${opts.handle}:${hour}`,
      p_event_cap: settings.maxAnalysesPerEvent,
      p_ip_cap: settings.perIpHourlyCap,
      p_handle_cap: settings.perIpHourlyCap,
      p_window_start: `${hour}:00:00.000Z`,
    });

    if (error || data !== 'allowed') return denied(data);
    return { allowed: true };
  } catch {
    return denied(null);
  }
}
