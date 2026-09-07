import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const settingsMock = vi.hoisted(() => ({ getSettings: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('../../src/lib/settings', () => settingsMock);

import { getProvider } from '../../src/lib/providers/index';

const withProvider = (primaryProvider: string) =>
  settingsMock.getSettings.mockResolvedValue({ primaryProvider });

beforeEach(() => {
  settingsMock.getSettings.mockReset();
  delete process.env.MOCK;
});

afterEach(() => {
  delete process.env.MOCK;
});

describe('getProvider', () => {
  it('honours the runtime setting', async () => {
    withProvider('brightdata');
    expect((await getProvider()).name).toBe('brightdata');

    withProvider('mock');
    expect((await getProvider()).name).toBe('mock');
  });

  it('falls back to the real provider on an unrecognized value rather than throwing', async () => {
    // A settings row edited from a phone under pressure must not take the product down.
    withProvider('brigthdata');
    expect((await getProvider()).name).toBe('brightdata');
  });

  it('lets MOCK=1 win over the stored setting, so CI never touches the network', async () => {
    process.env.MOCK = '1';
    withProvider('brightdata');
    expect((await getProvider()).name).toBe('mock');
    expect(settingsMock.getSettings).not.toHaveBeenCalled();
  });
});
