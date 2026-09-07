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

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await context.params;
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
