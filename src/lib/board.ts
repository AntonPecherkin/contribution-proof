import { labelForTopic } from './taxonomy';

/**
 * Builds the room board payload.
 *
 * Pure, so the rule that matters can be tested exhaustively: **a participant who did not opt
 * in must be absent from the payload**, not hidden by the client. Anything serialized here
 * is on a projector in a public room.
 *
 * Aggregates count everyone, because a count is not an identity. Named rows require consent.
 */

export type BoardRow = {
  handle: string;
  score: number;
  kind: 'analysis' | 'profile';
  topTopic: string | null;
};

export type BoardPayload = {
  /** Distinct accounts with a completed analysis, opted in or not. */
  analysed: number;
  technologyPosts: number;
  totalViews: number | null;
  roomTopics: string[];
  /** Most recent first. Includes profile results — everyone appears here. */
  justIn: BoardRow[];
  /** Highest scoring. Profile results never rank here; their scale is different. */
  topToday: BoardRow[];
};

/** One completed analysis per handle. Several leads may request the same account. */
export type CompletedAnalysis = {
  handle: string;
  score: number | null;
  kind: 'analysis' | 'profile' | null;
  technologyPosts: number | null;
  views: number | null;
  topics: string[] | null;
  completedAt: string | null;
  optedIn: boolean;
};

/** Contribution Scores start here; Profile Scores stay below it. */
const RANKABLE_FLOOR = 100;

export function buildBoard(rows: readonly CompletedAnalysis[], limit = 6): BoardPayload {
  // Deduplicate by handle: two people submitting the same account must not double the room.
  const unique = new Map<string, CompletedAnalysis>();
  for (const r of rows) if (!unique.has(r.handle)) unique.set(r.handle, r);
  const all = [...unique.values()];

  const technologyPosts = all.reduce((sum, r) => sum + (r.technologyPosts ?? 0), 0);
  const viewRows = all.filter((r) => r.views !== null);
  const totalViews = viewRows.length
    ? viewRows.reduce((sum, r) => sum + (r.views ?? 0), 0)
    : null;

  const topicCounts = new Map<string, number>();
  for (const r of all) {
    for (const t of r.topics ?? []) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
  }
  const roomTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([id]) => labelForTopic(id));

  // From here on, only consenting participants. This is the whole privacy boundary.
  const named = all.filter((r) => r.optedIn && r.score !== null);
  const toRow = (r: CompletedAnalysis): BoardRow => ({
    handle: r.handle,
    score: r.score ?? 0,
    kind: r.kind ?? 'analysis',
    topTopic: r.topics?.[0] ? labelForTopic(r.topics[0]) : null,
  });

  const justIn = [...named]
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, limit)
    .map(toRow);

  const topToday = named
    .filter((r) => (r.score ?? 0) >= RANKABLE_FLOOR)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.handle.localeCompare(b.handle))
    .slice(0, 3)
    .map(toRow);

  return { analysed: all.length, technologyPosts, totalViews, roomTopics, justIn, topToday };
}
