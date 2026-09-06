import type { PostProvider, ProfileResult, Post } from './types';

import rich from '../../../fixtures/brightdata/rich.json';
import thin from '../../../fixtures/brightdata/thin.json';

/**
 * Fixture-backed provider. Selected by `MOCK=1`, or by setting `primary_provider` to
 * `'mock'` at runtime — which is also the event-day escape hatch if every real provider
 * fails at once.
 *
 * Handles are routed by name so that every path is reachable without a network:
 *
 *   devbuilder     20 posts, 15 eligible          -> good evidence
 *   thinbuilder    3 posts                        -> directional result
 *   emptybuilder   0 posts                        -> no score
 *   lockedaccount  protected                      -> private
 *   slowbuilder    async collection               -> pending, then resolves
 *   brokenapi      provider failure               -> provider
 *   anything else                                 -> invalid_handle
 */

type RawPost = {
  id: string;
  description: string;
  date_posted: string;
  likes: number;
  reposts: number;
  replies: number;
  views?: number;
  quoted_post: { id: string } | null;
  parent_post_details: { id: string } | null;
  is_repost: boolean;
};

/**
 * Deliberately mirrors what a real adapter must do, so that a bug in this mapping shows up
 * in development rather than only in production. Note `views`: absent means `null`, and it
 * must not become 0.
 */
function toPost(raw: RawPost): Post {
  return {
    id: raw.id,
    text: raw.description,
    createdAt: new Date(raw.date_posted).toISOString(),
    views: raw.views ?? null,
    replies: raw.replies ?? null,
    reposts: raw.reposts ?? null,
    likes: raw.likes ?? null,
    isReply: raw.parent_post_details !== null,
    isRepost: raw.is_repost === true,
    isQuote: raw.quoted_post !== null,
  };
}

const profile = (posts: RawPost[], limit: number): ProfileResult => ({
  ok: true,
  handle: 'devbuilder',
  displayName: 'Dev Builder',
  followers: 4821,
  posts: posts.slice(0, limit).map(toPost),
});

export const mockProvider: PostProvider = {
  name: 'mock',

  async fetchRecentPosts(handle: string, limit: number): Promise<ProfileResult> {
    switch (handle.toLowerCase()) {
      case 'devbuilder':
        return profile(rich as RawPost[], limit);
      case 'thinbuilder':
        return profile(thin as RawPost[], limit);
      case 'emptybuilder':
        return { ok: false, errorClass: 'empty' };
      case 'lockedaccount':
        return { ok: false, errorClass: 'private' };
      case 'slowbuilder':
        return { ok: false, pending: true, snapshotId: 's_m2k9x4qp0000abcd' };
      case 'brokenapi':
        return { ok: false, errorClass: 'provider' };
      default:
        return { ok: false, errorClass: 'invalid_handle' };
    }
  },

  async resolveSnapshot(snapshotId: string): Promise<ProfileResult> {
    if (snapshotId === 's_m2k9x4qp0000abcd') return profile(rich as RawPost[], 20);
    return { ok: false, errorClass: 'provider' };
  },
};
