import type { Post, ProfileResult } from './types';

/**
 * Pure mapping from the provider's profile row to our contract.
 *
 * It lives in its own file, with no I/O and no `server-only`, so the real provider and the
 * fixture provider share one implementation. A mock that maps differently from the thing it
 * stands in for is worse than no mock at all.
 */

export type RawPost = {
  post_id?: string | null;
  post_url?: string | null;
  description?: string | null;
  date_posted?: string | null;
  likes?: number | null;
  replies?: number | null;
  reposts?: number | null;
  views?: number | null;
};

export type RawProfile = {
  id?: string | null;
  profile_name?: string | null;
  followers?: number | null;
  posts?: RawPost[] | null;
  error?: string | null;
  error_code?: string | null;
  warning?: string | null;
};

/** '…/status/123…' -> '123'. The only id available when post_id comes back null. */
export const idFromUrl = (url: string | null | undefined): string | null =>
  url?.match(/\/status\/(\d+)/)?.[1] ?? null;

/**
 * The dataset carries no reply, repost or quote indicator, so eligibility is inferred from
 * the text. A post opening with a mention is a reply in the overwhelming majority of cases;
 * nothing distinguishes a repost or a quote at all.
 *
 * This is weaker than the rule the product states, which is why the result discloses it. A
 * cleverer guess would corrupt the score silently; a stated limitation does not.
 */
export const looksLikeReply = (text: string): boolean => /^\s*@\w/.test(text);

export function toPost(raw: RawPost): Post | null {
  const id = raw.post_id ?? idFromUrl(raw.post_url);
  const text = raw.description ?? null;
  const created = raw.date_posted ?? null;

  // Observed: the first embedded post frequently carries only a URL and a view count.
  // With no text and no timestamp there is nothing to classify and no week to place it in,
  // so it is not evidence and must not inflate the analyzed count.
  if (id === null || !text || !created) return null;

  const at = new Date(created);
  if (Number.isNaN(at.getTime())) return null;

  return {
    id,
    text,
    createdAt: at.toISOString(),
    // Observed on 28-50% of posts. Absent means unreported, never zero.
    views: raw.views ?? null,
    replies: raw.replies ?? null,
    reposts: raw.reposts ?? null,
    likes: raw.likes ?? null,
    isReply: looksLikeReply(text),
    isRepost: false,
    isQuote: false,
  };
}

/** Row-level error codes the dataset returns with `include_errors=true`. */
function errorFromRow(row: RawProfile): ProfileResult | null {
  const code = (row.error_code ?? '').toLowerCase();
  const message = `${row.error ?? ''} ${row.warning ?? ''}`.toLowerCase();

  if (code === 'protected_account' || message.includes('protected')) {
    return { ok: false, errorClass: 'private' };
  }
  if (code === 'dead_page' || message.includes('not found') || row.error) {
    return { ok: false, errorClass: 'invalid_handle' };
  }
  return null;
}

export function mapProfileRow(row: RawProfile, limit: number): ProfileResult {
  const rowError = errorFromRow(row);
  if (rowError) return rowError;

  // The whole game. `posts: null` is neither an error nor an empty account: the profile came
  // back fine, reporting a real posts_count, and the array is null anyway. Measured to happen
  // reliably for small accounts, which at a developer event is the common case.
  if (row.posts === null || row.posts === undefined) {
    return { ok: false, errorClass: 'no_posts_available' };
  }
  if (row.posts.length === 0) return { ok: false, errorClass: 'empty' };

  // Measured: the provider returns posts in no useful order, spanning years. Taking the
  // array as given would make "the latest N posts" mean "N arbitrary posts since 2018".
  // Sort before slicing so the window is at least the newest ones available.
  const posts = row.posts
    .map(toPost)
    .filter((p): p is Post => p !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  if (posts.length === 0) return { ok: false, errorClass: 'no_posts_available' };

  return {
    ok: true,
    handle: row.id ?? '',
    displayName: row.profile_name ?? '',
    followers: row.followers ?? null,
    posts,
  };
}
