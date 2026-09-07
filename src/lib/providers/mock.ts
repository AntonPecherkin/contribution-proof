import type { PostProvider, ProfileResult, Post } from './types';

import rich from '../../../fixtures/brightdata/rich.json';
import thin from '../../../fixtures/brightdata/thin.json';

/**
 * Fixture-backed provider. Selected by `MOCK=1`, or by setting `primary_provider` to
 * `'mock'` at runtime — the event-day escape hatch if collection fails.
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

type RawPost = {
  post_id: string | null;
  post_url: string | null;
  description: string | null;
  date_posted: string | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  views: number | null;
};

type RawProfile = {
  id: string;
  profile_name: string;
  followers: number | null;
  posts: RawPost[] | null;
};

/** '…/status/123…' -> '123'. The only id available when post_id comes back null. */
const idFromUrl = (url: string | null): string | null =>
  url?.match(/\/status\/(\d+)/)?.[1] ?? null;

/**
 * The provider carries no reply, repost, or quote indicator, so eligibility has to be
 * inferred from the text. A post opening with a mention is a reply in the overwhelming
 * majority of cases; nothing distinguishes a repost or quote at all.
 *
 * This is weaker than the rule the product states, and the result must say so rather than
 * imply a precision we do not have.
 */
const looksLikeReply = (text: string): boolean => /^\s*@\w/.test(text);

function toPost(raw: RawPost): Post | null {
  const id = raw.post_id ?? idFromUrl(raw.post_url);
  // Observed: some embedded posts carry only a URL and a view count. Without text or a
  // timestamp there is nothing to classify or place in a week, so they are dropped rather
  // than counted as evidence.
  if (id === null || !raw.description || !raw.date_posted) return null;

  return {
    id,
    text: raw.description,
    createdAt: new Date(raw.date_posted).toISOString(),
    // Observed on 28-50% of posts. Absent means unreported, never zero.
    views: raw.views ?? null,
    replies: raw.replies ?? null,
    reposts: raw.reposts ?? null,
    likes: raw.likes ?? null,
    isReply: looksLikeReply(raw.description),
    isRepost: false,
    isQuote: false,
  };
}

function fromProfile(row: RawProfile, limit: number): ProfileResult {
  if (row.posts === null) return { ok: false, errorClass: 'no_posts_available' };
  if (row.posts.length === 0) return { ok: false, errorClass: 'empty' };

  const posts = row.posts
    .map(toPost)
    .filter((p): p is Post => p !== null)
    .slice(0, limit);

  if (posts.length === 0) return { ok: false, errorClass: 'no_posts_available' };

  return {
    ok: true,
    handle: row.id,
    displayName: row.profile_name,
    followers: row.followers,
    posts,
  };
}

export const mockProvider: PostProvider = {
  name: 'mock',

  async fetchRecentPosts(handle: string, limit: number): Promise<ProfileResult> {
    switch (handle.toLowerCase()) {
      case 'devbuilder':
        return fromProfile((rich as RawProfile[])[0], limit);
      case 'thinbuilder':
        return fromProfile((thin as RawProfile[])[0], limit);
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
      return fromProfile((rich as RawProfile[])[0], 20);
    }
    return { ok: false, errorClass: 'provider' };
  },
};
