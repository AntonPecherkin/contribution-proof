import { NextResponse } from 'next/server';

import { buildBoard, type CompletedAnalysis } from '../../../../../lib/board';
import { getDb } from '../../../../../lib/db';

/**
 * The room board, assembled server-side from an allowlist.
 *
 * The client never touches the database and never receives a row it should not display —
 * a non-consenting handle is absent from the response, not hidden by CSS.
 */

export const revalidate = 0;

/**
 * MOCK=1 serves a representative room so the board can be designed, demoed and rehearsed
 * with no database and no event. The numbers are the real measured ones.
 */
function mockRoom(): CompletedAnalysis[] {
  const at = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();
  return [
    { handle: 'superteammy', score: 780, kind: 'analysis', technologyPosts: 13, views: 155_952, topics: ['scaling', 'open-source', 'devtools'], completedAt: at(52), optedIn: true },
    { handle: 'jemmmyjemm', score: 760, kind: 'analysis', technologyPosts: 13, views: 100_926, topics: ['scaling', 'open-source'], completedAt: at(3), optedIn: true },
    { handle: 'nikkideyy', score: 710, kind: 'analysis', technologyPosts: 9, views: 55_396, topics: ['open-source', 'creator-economy'], completedAt: at(18), optedIn: true },
    { handle: 'ohmeohmy_sol', score: 570, kind: 'analysis', technologyPosts: 8, views: 13_691, topics: ['scaling', 'payments'], completedAt: at(9), optedIn: true },
    { handle: 'nicfury', score: 540, kind: 'analysis', technologyPosts: 4, views: 13_326, topics: ['prediction', 'consensus'], completedAt: at(26), optedIn: true },
    { handle: 'contentdc', score: 54, kind: 'profile', technologyPosts: null, views: null, topics: ['creator-economy', 'prediction'], completedAt: at(1), optedIn: true },
    { handle: 'aapecherkin', score: 51, kind: 'profile', technologyPosts: null, views: null, topics: ['scaling', 'language-models'], completedAt: at(14), optedIn: true },
    // Present in the totals, absent from every named list.
    { handle: 'did-not-opt-in', score: 690, kind: 'analysis', technologyPosts: 11, views: 40_000, topics: ['security'], completedAt: at(7), optedIn: false },
  ];
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await context.params;

  if (process.env.MOCK === '1') {
    return NextResponse.json(buildBoard(mockRoom()), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const db = getDb();

  const { data: event } = await db.from('events').select('id').eq('slug', slug).maybeSingle();
  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Board opt-in lives on participants; the score lives on analyses. A handle counts as
  // opted in when any participant who requested it consented.
  const [{ data: analyses }, { data: participants }] = await Promise.all([
    db
      .from('analyses')
      .select('x_handle_normalized,score_total,result_kind,posts_technology,views_total,topics,completed_at')
      .eq('event_id', event.id)
      .eq('status', 'complete')
      .order('completed_at', { ascending: false })
      .limit(500),
    db.from('participants').select('x_handle_normalized').eq('event_id', event.id).eq('board_opt_in', true),
  ]);

  const consented = new Set((participants ?? []).map((p) => p.x_handle_normalized));

  const rows: CompletedAnalysis[] = (analyses ?? []).map((a) => ({
    handle: a.x_handle_normalized,
    score: a.score_total,
    kind: a.result_kind,
    technologyPosts: a.posts_technology,
    views: a.views_total,
    topics: a.topics,
    completedAt: a.completed_at,
    optedIn: consented.has(a.x_handle_normalized),
  }));

  return NextResponse.json(buildBoard(rows), {
    headers: { 'Cache-Control': 's-maxage=3, stale-while-revalidate=10' },
  });
}
