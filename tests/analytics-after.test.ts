import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn() }));
const afterMock = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../src/lib/db', () => ({ getDb: () => ({ from: dbMocks.from }) }));
vi.mock('next/server', () => ({ after: afterMock }));

import { track } from '../src/lib/analytics';

/**
 * A serverless function is frozen once its response is sent, so an un-awaited promise can be
 * killed mid-insert. The events most likely to be lost are the last ones in a request — which
 * is where `lead_registered`, the primary KPI, lives. These tests pin the deferral mechanism,
 * not just the fact that `track` returns quickly.
 */
describe('track defers the write past the response', () => {
  beforeEach(() => {
    dbMocks.insert.mockReset().mockResolvedValue({ error: null });
    dbMocks.from.mockReset().mockReturnValue({ insert: dbMocks.insert });
    afterMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('hands the insert to after() rather than detaching it', async () => {
    afterMock.mockImplementation((work: () => unknown) => work());

    await track('lead_registered', undefined, { sessionId: 's1' });

    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(dbMocks.insert).toHaveBeenCalledTimes(1);
  });

  it('still records the event when after() is unavailable', async () => {
    // Outside a request scope — scripts, tests — `after` throws. The write must still happen.
    afterMock.mockImplementation(() => {
      throw new Error('after() called outside a request scope');
    });

    await track('lead_registered', undefined, { sessionId: 's1' });
    await vi.waitFor(() => expect(dbMocks.insert).toHaveBeenCalledTimes(1));
  });

  it('never rejects, even when after() and the database both fail', async () => {
    afterMock.mockImplementation(() => {
      throw new Error('no request scope');
    });
    dbMocks.insert.mockRejectedValue(new Error('database unreachable'));

    await expect(track('share_completed', undefined, undefined)).resolves.toBeUndefined();
  });
});
