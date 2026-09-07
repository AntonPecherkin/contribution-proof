import { topicsOf } from './classify';
import type { ProfileSummary } from './providers/types';

/**
 * The result for accounts whose posts the provider will not give us.
 *
 * Measured at roughly a third of accounts, concentrated in the small ones — which at a
 * developer event is most of the room. The alternative was showing those people nothing,
 * so this shows them what we actually know: their bio, read the same way their posts would
 * have been, plus the facts on their profile.
 *
 * It deliberately carries **no score**. A number derived from a bio is not comparable with
 * one derived from twenty posts, and putting both on the same board would make the board
 * lie. Everything here is a stated fact about the account, not a judgement of it.
 */

export type ReducedResult = {
  profile: ProfileSummary;
  /** Topics inferred from the bio, using the same taxonomy the posts use. */
  topics: string[];
  matchedWords: string[];
  accountAgeYears: number | null;
  postsPerYear: number | null;
  followerRatio: number | null;
  /** Why they got this instead of a full result. Shown verbatim; never blames the person. */
  reason: string;
};

const REASON =
  'X did not return this account’s posts to us. That usually happens with accounts ' +
  'that have posted fewer times, and it is a limit of our data source rather than ' +
  'anything about the account.';

export function reducedResult(profile: ProfileSummary, now: Date = new Date()): ReducedResult {
  const { topics, matched } = profile.bio ? topicsOf(profile.bio) : { topics: [], matched: [] };

  const joined = profile.joinedAt ? new Date(profile.joinedAt) : null;
  const ageYears =
    joined && !Number.isNaN(joined.getTime())
      ? Math.max(0, (now.getTime() - joined.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

  return {
    profile,
    topics,
    matchedWords: [...new Set(matched)],
    accountAgeYears: ageYears === null ? null : Number(ageYears.toFixed(1)),
    // Guard the divisor: an account created today would otherwise divide by ~0 and report
    // a posts-per-year figure in the thousands.
    postsPerYear:
      profile.postsCount !== null && ageYears !== null && ageYears >= 0.1
        ? Math.round(profile.postsCount / ageYears)
        : null,
    followerRatio:
      profile.followers !== null && profile.following !== null && profile.following > 0
        ? Number((profile.followers / profile.following).toFixed(2))
        : null,
    reason: REASON,
  };
}
