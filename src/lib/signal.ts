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
 * It carries a **Profile Score of up to 100**, on the same visible scale as the Contribution
 * Score, which starts at 100. One scale, two non-overlapping ranges: every card reads the
 * same way, and a bio can never appear to beat twenty analysed posts.
 *
 * Both render bare — nothing on screen ever shows a denominator.
 *
 * The other rule: no signal is ever a deficit. We never render "only 186 followers" or
 * "just 97 posts". If a fact cannot be said warmly and truthfully, it is left out. The
 * badges are the hero; the number is secondary.
 */

export type Signal = { id: string; label: string; detail: string };

/**
 * Four parts of 25, weighted toward size and activity.
 *
 * An earlier version gave a quarter of the score for tenure and a quarter for bio keywords,
 * so a dormant six-year-old account with three technical words in its bio scored 82 while
 * posting seventeen times a year. Age and vocabulary are not contribution. Audience, output
 * and rate are at least evidence of it.
 */
export type ProfileComponents = {
  audience: number;
  output: number;
  activity: number;
  topics: number;
};

export const PROFILE_CAP = 25;
/** Bio topics that earn full marks. Weak evidence, so it is the smallest lever. */
export const TOPIC_TARGET = 3;

export type ProfileSignal = {
  profile: ProfileSummary;
  /** Topics inferred from the bio, using the same taxonomy the posts use. */
  topics: string[];
  matchedWords: string[];
  accountAgeYears: number | null;
  postsPerYear: number | null;
  followerRatio: number | null;
  /** 0-100, rendered bare — no denominator, like every score here. Never on the board. */
  profileScore: number;
  components: ProfileComponents;
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

/**
 * Stepped thresholds rather than a log curve.
 *
 * A log scale is far too generous at the bottom: 186 followers against a 10,000 ceiling
 * still returns 0.57, so a small account collects most of the component. Steps make the
 * bands explicit, and an account below the first band scores zero for that part instead of
 * half of it.
 */
const band = (value: number | null, steps: readonly [number, number][]): number => {
  if (value === null) return 0;
  let earned = 0;
  for (const [threshold, points] of steps) if (value >= threshold) earned = points;
  return earned;
};

// Warmer at the bottom than the first attempt, which handed a real account a 19. Everyone
// who shows up with an account clears the first band; the top bands still take real scale to
// reach, so the component keeps discriminating.
const FOLLOWER_BANDS: readonly [number, number][] = [
  [0, 4], [50, 8], [250, 13], [1_000, 18], [5_000, 22], [20_000, 25],
];
const OUTPUT_BANDS: readonly [number, number][] = [
  [0, 4], [50, 9], [300, 14], [1_500, 19], [8_000, 25],
];
const ACTIVITY_BANDS: readonly [number, number][] = [
  [0, 4], [6, 9], [30, 14], [100, 19], [350, 25],
];
const TOPIC_BANDS: readonly [number, number][] = [[1, 10], [2, 18], [3, 25]];

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

  // Each component is 0-25 and rounded, so the visible parts add up to the visible whole.
  // A missing fact scores 0 for that part rather than blocking the score: we would rather
  // hand someone 41 with three parts than nothing at all.
  const components: ProfileComponents = {
    audience: band(profile.followers, FOLLOWER_BANDS),
    output: band(profile.postsCount, OUTPUT_BANDS),
    activity: band(postsPerYear, ACTIVITY_BANDS),
    topics: band(topics.length, TOPIC_BANDS),
  };

  return {
    profile,
    topics,
    matchedWords: [...new Set(matched)],
    profileScore:
      components.audience + components.output + components.activity + components.topics,
    components,
    accountAgeYears: ageYears === null ? null : Number(ageYears.toFixed(1)),
    postsPerYear,
    followerRatio,
    headline: headlineFor(joinedValid ? joinedValid.getUTCFullYear() : null, topics),
    signals,
    note: NOTE,
  };
}
