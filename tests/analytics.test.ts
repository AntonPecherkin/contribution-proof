import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../src/lib/db', () => ({
  getDb: () => ({ from: dbMocks.from }),
}));

import { track } from '../src/lib/analytics';

describe('track', () => {
  beforeEach(() => {
    dbMocks.insert.mockReset();
    dbMocks.insert.mockResolvedValue({ error: null });
    dbMocks.from.mockReset();
    dbMocks.from.mockReturnValue({ insert: dbMocks.insert });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inserts one well-formed analytics event', async () => {
    await track(
      'analysis_completed',
      { lane: 'warm', evidence_band: 'good', score_bucket: '800-1000' },
      { eventId: 'event-1', sessionId: 'session-1' },
    );

    expect(dbMocks.from).toHaveBeenCalledWith('analytics_events');
    expect(dbMocks.insert).toHaveBeenCalledOnce();
    expect(dbMocks.insert).toHaveBeenCalledWith({
      name: 'analysis_completed',
      props: { lane: 'warm', evidence_band: 'good', score_bucket: '800-1000' },
      event_id: 'event-1',
      session_id: 'session-1',
    });
  });

  it('silently drops disallowed props and invalid allowed-key values', async () => {
    await track('handle_submitted', {
      lane: 'warm',
      handle: 'must-not-be-recorded',
      provider: 'must-not-be-recorded',
    });

    expect(dbMocks.insert).toHaveBeenCalledWith({
      name: 'handle_submitted',
      props: { lane: 'warm' },
      event_id: null,
      session_id: null,
    });
  });

  it('swallows a database error response', async () => {
    dbMocks.insert.mockResolvedValue({ error: new Error('database unavailable') });

    await expect(track('landing_viewed')).resolves.toBeUndefined();
  });

  it('swallows a synchronous database failure', async () => {
    dbMocks.insert.mockImplementation(() => {
      throw new Error('database unavailable');
    });

    await expect(track('landing_viewed')).resolves.toBeUndefined();
  });

  it('resolves even when the database client rejects', async () => {
    dbMocks.insert.mockRejectedValue(new Error('connection lost'));

    await expect(track('landing_viewed')).resolves.toBeUndefined();
  });

  it('resolves without waiting for a pending database request', async () => {
    dbMocks.insert.mockReturnValue(new Promise(() => undefined));
    let resolved = false;

    void track('landing_viewed').then(() => {
      resolved = true;
    });
    await Promise.resolve();

    expect(resolved).toBe(true);
  });
});
