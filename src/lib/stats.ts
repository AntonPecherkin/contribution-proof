import type { Post } from './providers/types';
import type { Classification } from './classify';
import { longestStreak, relevantPosts, weekKey } from './analysis';

/**
 * The entertaining half. Every figure here is a plain fact about the posts we read — no
 * judgement, no model — which is exactly why they land: nobody argues with "your longest
 * streak was 14 weeks", and everybody screenshots it.
 */

export type FunStats = {
  /** The window we actually read, so the page never implies more recency than it has. */
  from: string;
  to: string;
  spanWeeks: number;
  postsAnalyzed: number;
  /** Longest run of consecutive weeks with at least one post. */
  longestStreakWeeks: number;
  busiestWeekday: string | null;
  medianLength: number;
  longestPostChars: number;
  threadStarts: number;
  linkShareRate: number;
  questionRate: number;
  bestPost: { id: string; text: string; views: number | null; likes: number | null } | null;
  totalViews: number | null;
  medianViews: number | null;
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

export function funStats(posts: readonly Post[]): FunStats | null {
  if (posts.length === 0) return null;

  const dates = posts.map((p) => new Date(p.createdAt)).sort((a, b) => a.getTime() - b.getTime());
  const from = dates[0].toISOString().slice(0, 10);
  const to = dates[dates.length - 1].toISOString().slice(0, 10);
  const spanMs = dates[dates.length - 1].getTime() - dates[0].getTime();

  const weekdayCounts = new Map<number, number>();
  for (const d of dates) weekdayCounts.set(d.getUTCDay(), (weekdayCounts.get(d.getUTCDay()) ?? 0) + 1);
  const busiest = [...weekdayCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const lengths = posts.map((p) => p.text.trim().length);
  const withViews = posts.filter((p) => p.views !== null) as (Post & { views: number })[];

  // Rank by views when we have them, and fall back to likes when we do not — on this
  // provider views are absent more often than not.
  const best =
    withViews.length > 0
      ? withViews.reduce((a, b) => (b.views > a.views ? b : a))
      : posts.reduce((a, b) => ((b.likes ?? 0) > (a.likes ?? 0) ? b : a));

  return {
    from,
    to,
    spanWeeks: Math.max(1, Math.round(spanMs / (7 * 24 * 60 * 60 * 1000))),
    postsAnalyzed: posts.length,
    longestStreakWeeks: longestStreak([...new Set(posts.map((p) => weekKey(p.createdAt)))].sort()),
    busiestWeekday: busiest ? WEEKDAYS[busiest[0]] : null,
    medianLength: median(lengths),
    longestPostChars: Math.max(...lengths),
    threadStarts: posts.filter((p) => /(\b1\/\d+|🧵)/.test(p.text)).length,
    linkShareRate: Number((posts.filter((p) => /https?:\/\//.test(p.text)).length / posts.length).toFixed(2)),
    questionRate: Number((posts.filter((p) => p.text.includes('?')).length / posts.length).toFixed(2)),
    bestPost: best
      ? { id: best.id, text: best.text.slice(0, 240), views: best.views, likes: best.likes }
      : null,
    totalViews: withViews.length ? withViews.reduce((s, p) => s + p.views, 0) : null,
    medianViews: withViews.length ? median(withViews.map((p) => p.views)) : null,
  };
}

/**
 * People engaged in technology, estimated.
 *
 * Every like, repost and reply on the posts the classifier called technology. Each one is an
 * account acting, so the sum is an *upper* bound on distinct people: the same person can like
 * a post and repost it. That is why it is shown with a "~" and never as an exact figure.
 *
 * Deliberately not views. The provider reports views on roughly a third of posts and these
 * three on nearly all of them, so this is both the larger number and the better evidenced one.
 *
 * Null when the provider reported none of the three across every technology post. Zero means
 * it reported them and nobody engaged, which is a different and true thing to say.
 */
export function peopleEngagedInTech(
  posts: readonly Post[],
  classification: Classification,
): number | null {
  const values = relevantPosts(posts, classification)
    .flatMap((p) => [p.likes, p.reposts, p.replies])
    .filter((v): v is number => v !== null);
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0);
}

/**
 * Whole days since the account joined.
 *
 * The one figure on the card available for every account we can read at all, and the only one
 * that cannot be lowered by a quiet year. Clamped at zero rather than trusting a join date in
 * the future, and null when the provider omitted or mangled it.
 */
export function daysBuilding(joinedAt: string | null): number | null {
  if (!joinedAt) return null;
  const joined = new Date(joinedAt).getTime();
  if (Number.isNaN(joined)) return null;
  return Math.max(0, Math.floor((Date.now() - joined) / 86_400_000));
}
