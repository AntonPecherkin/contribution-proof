import { topicsOf } from './classify';
import { labelForTopic } from './taxonomy';
import type { ProfileSummary } from './providers/types';

/**
 * Profile Signal — the result for accounts whose posts the provider will not hand over.
 *
 * That is roughly a third of accounts, concentrated in the small ones, which at a developer
 * event is most of the room. Those people stand next to a friend holding a 750 and must not
 * feel handed a consolation prize, so this is built to be *liked*: every signal below is a
 * true statement framed as something worth being.
 *
 * Two rules hold it honest. It carries **no 0-1000 score**, because a bio and twenty posts
 * are not the same measurement and a shared board would make them look like one. And no
 * signal is ever a deficit — we never render "only 186 followers" or "just 97 posts". If a
 * fact cannot be said warmly and truthfully, it is left out.
 */

export type Signal = { id: string; label: string; detail: string };

export type ProfileSignal = {
  profile: ProfileSummary;
  /** Topics inferred from the bio, using the same taxonomy the posts use. */
  topics: string[];
  matchedWords: string[];
  accountAgeYears: number | null;
  postsPerYear: number | null;
  followerRatio: number | null;
  /** Short, specific, and never generic — this is what people screenshot. */
  headline: string;
  signals: Signal[];
  /** Why there is no score. Names our data source as the limit, never the person. */
  note: string;
};

const NOTE =
  'We read your profile rather than your posts this time — X did not hand them over, ' +
  'which happens with accounts that post less often. Nothing about your account is wrong.';

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

function headlineFor(joinedYear: number | null, topics: string[]): string {
  if (joinedYear !== null) return `Class of ${joinedYear}`;
  if (topics.length > 0) return labelForTopic(topics[0]);
  return 'New around here';
}

export function profileSignal(profile: ProfileSummary, now: Date = new Date()): ProfileSignal {
  const { topics, matched } = profile.bio ? topicsOf(profile.bio) : { topics: [], matched: [] };

  const joined = profile.joinedAt ? new Date(profile.joinedAt) : null;
  const joinedValid = joined && !Number.isNaN(joined.getTime()) ? joined : null;
  const ageYears = joinedValid
    ? Math.max(0, (now.getTime() - joinedValid.getTime()) / YEAR_MS)
    : null;

  // Guard the divisor: an account created this week would otherwise report thousands a year.
  const postsPerYear =
    profile.postsCount !== null && ageYears !== null && ageYears >= 0.1
      ? Math.round(profile.postsCount / ageYears)
      : null;

  const followerRatio =
    profile.followers !== null && profile.following !== null && profile.following > 0
      ? Number((profile.followers / profile.following).toFixed(2))
      : null;

  const signals: Signal[] = [];
  const add = (id: string, label: string, detail: string) => signals.push({ id, label, detail });

  if (profile.isVerified) add('verified', 'Verified', 'X has confirmed this account');

  if (ageYears !== null && ageYears >= 5) {
    add('veteran', 'Long hauler', `${Math.floor(ageYears)} years on X`);
  } else if (ageYears !== null && ageYears >= 2) {
    add('established', 'Established', `${Math.floor(ageYears)} years on X`);
  } else if (ageYears !== null) {
    add('newcomer', 'Fresh start', 'Joined within the last two years');
  }

  if (postsPerYear !== null && postsPerYear >= 150) {
    add('prolific', 'Prolific', `About ${postsPerYear} posts a year`);
  } else if (postsPerYear !== null && postsPerYear >= 20) {
    add('steady', 'Steady hand', `About ${postsPerYear} posts a year`);
  } else if (postsPerYear !== null) {
    add('selective', 'Selective', 'Posts when there is something to say');
  }

  // Both ends of the ratio are said warmly. Being widely followed is a signal; following
  // widely is curiosity. Neither is a shortfall, and neither is compared to anyone else.
  if (followerRatio !== null && followerRatio >= 5) {
    add('amplified', 'Carries', `${followerRatio}× more followers than following`);
  } else if (followerRatio !== null && followerRatio < 1) {
    add('curious', 'Curious', 'Follows more people than follow back');
  }

  if (topics.length >= 3) {
    add('range', 'Range', `${topics.length} technical areas in your bio`);
  } else if (topics.length > 0) {
    add('focused', 'Focused', `On ${topics.map(labelForTopic).join(' and ')}`);
  }

  if (profile.externalLink) add('ships', 'Ships things', 'There is a link in your bio');
  if (profile.location) add('located', 'On the map', profile.location);

  return {
    profile,
    topics,
    matchedWords: [...new Set(matched)],
    accountAgeYears: ageYears === null ? null : Number(ageYears.toFixed(1)),
    postsPerYear,
    followerRatio,
    headline: headlineFor(joinedValid ? joinedValid.getUTCFullYear() : null, topics),
    signals,
    note: NOTE,
  };
}
