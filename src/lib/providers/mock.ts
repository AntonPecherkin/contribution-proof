import type { PostProvider, ProfileResult, Post } from './types';

import rich from '../../../fixtures/twitterapi/rich.json';
import thin from '../../../fixtures/twitterapi/thin.json';

/**
 * Fixture-backed provider. Selected by `MOCK=1`, or by setting `primary_provider` to
 * `'mock'` at runtime — which is also the event-day escape hatch if the real provider fails.
 *
 * Handles route by name so every path is reachable with no network:
 *
 *   devbuilder     20 tweets, 15 eligible   -> good evidence
 *   thinbuilder    3 tweets                 -> directional result
 *   emptybuilder   0 tweets                 -> empty
 *   lockedaccount  protected                -> private
 *   brokenapi      upstream failure         -> provider
 *   anything else                           -> invalid_handle
 */

type RawTweet = {
  id: string;
  text: string;
  createdAt: string;
  viewCount?: number;
  replyCount?: number;
  retweetCount?: number;
  likeCount?: number;
  isReply: boolean;
  quoted_tweet: unknown | null;
  retweeted_tweet: unknown | null;
};

// Observed shape: tweets are nested under `data`, not top level.
type RawEnvelope = { data: { tweets: RawTweet[] } };

/**
 * Mirrors what the real adapter must do, so a mapping bug surfaces in development rather
 * than only in production.
 *
 * Two things to preserve exactly: `createdAt` arrives in Twitter's own format
 * ("Tue Dec 10 07:00:30 +0000 2024") and must become ISO 8601; and an absent `viewCount`
 * becomes `null`, never 0 — the API does not always report impressions, and "not reported"
 * is not "nobody saw it".
 */
function toPost(raw: RawTweet): Post {
  return {
    id: raw.id,
    text: raw.text,
    createdAt: new Date(raw.createdAt).toISOString(),
    views: raw.viewCount ?? null,
    replies: raw.replyCount ?? null,
    reposts: raw.retweetCount ?? null,
    likes: raw.likeCount ?? null,
    isReply: raw.isReply === true,
    isRepost: raw.retweeted_tweet !== null,
    isQuote: raw.quoted_tweet !== null,
  };
}

const profile = (env: RawEnvelope, limit: number): ProfileResult => ({
  ok: true,
  handle: 'devbuilder',
  displayName: 'Dev Builder',
  followers: 4821,
  posts: env.data.tweets.slice(0, limit).map(toPost),
});

export const mockProvider: PostProvider = {
  name: 'mock',

  async fetchRecentPosts(handle: string, limit: number): Promise<ProfileResult> {
    switch (handle.toLowerCase()) {
      case 'devbuilder':
        return profile(rich as RawEnvelope, limit);
      case 'thinbuilder':
        return profile(thin as RawEnvelope, limit);
      case 'emptybuilder':
        return { ok: false, errorClass: 'empty' };
      case 'lockedaccount':
        return { ok: false, errorClass: 'private' };
      case 'brokenapi':
        return { ok: false, errorClass: 'provider' };
      default:
        return { ok: false, errorClass: 'invalid_handle' };
    }
  },
};
