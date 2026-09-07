import { mapProfileRow, type RawProfile } from './mapping';
import type { PostProvider, ProfileResult } from './types';

import rich from '../../../fixtures/brightdata/rich.json';
import thin from '../../../fixtures/brightdata/thin.json';

/**
 * Fixture-backed provider. Selected by `MOCK=1`, or by `primary_provider = 'mock'` at
 * runtime — the event-day escape hatch if collection fails.
 *
 * It shares `mapProfileRow` with the real provider on purpose: a mock that maps differently
 * from the thing it stands in for teaches the UI the wrong shape.
 *
 *   devbuilder     20 posts, mixed null views   -> good evidence
 *   thinbuilder    3 posts                      -> directional result
 *   smallbuilder   profile returned, posts null -> no_posts_available
 *   emptybuilder   0 posts                      -> empty
 *   lockedaccount  protected                    -> private
 *   slowbuilder    async collection             -> pending, then resolves
 *   brokenapi      upstream failure             -> provider
 *   anything else                               -> invalid_handle
 */

const profile = (rows: unknown, limit: number): ProfileResult =>
  mapProfileRow((rows as RawProfile[])[0], limit);

export const mockProvider: PostProvider = {
  name: 'mock',

  async fetchRecentPosts(handle: string, limit: number): Promise<ProfileResult> {
    switch (handle.toLowerCase()) {
      case 'devbuilder':
        return profile(rich, limit);
      case 'thinbuilder':
        return profile(thin, limit);
      case 'smallbuilder':
        return { ok: false, errorClass: 'no_posts_available' };
      case 'emptybuilder':
        return { ok: false, errorClass: 'empty' };
      case 'lockedaccount':
        return { ok: false, errorClass: 'private' };
      case 'slowbuilder':
        return { ok: false, pending: true, snapshotId: 'sd_mtqp13911t5rm8xv5a' };
      case 'brokenapi':
        return { ok: false, errorClass: 'provider' };
      default:
        return { ok: false, errorClass: 'invalid_handle' };
    }
  },

  async resolveSnapshot(snapshotId: string): Promise<ProfileResult> {
    if (snapshotId === 'sd_mtqp13911t5rm8xv5a') {
      return profile(rich, 20);
    }
    return { ok: false, errorClass: 'provider' };
  },
};
