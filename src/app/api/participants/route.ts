import { NextResponse } from 'next/server';

import { track } from '../../../lib/analytics';
import { getDb } from '../../../lib/db';
import { normalizeEmail } from '../../../lib/normalize';

/**
 * Record a lead.
 *
 * Deliberately independent of whether the analysis succeeds. Provider failures are common
 * and a lead is the event's primary KPI; losing one because a scrape came back empty would
 * be the wrong trade.
 */

export async function POST(request: Request): Promise<NextResponse> {
  let body: {
    analysisId?: unknown;
    email?: unknown;
    consentVersion?: unknown;
    boardOptIn?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : null;
  if (!email) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  if (typeof body.consentVersion !== 'string' || !body.consentVersion) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  }
  if (typeof body.analysisId !== 'string') {
    return NextResponse.json({ error: 'invalid_analysis' }, { status: 400 });
  }

  const db = getDb();
  const { data: analysis } = await db
    .from('analyses')
    .select('id,event_id,x_handle_normalized')
    .eq('id', body.analysisId)
    .maybeSingle();
  if (!analysis) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { error } = await db.from('participants').insert({
    event_id: analysis.event_id,
    analysis_id: analysis.id,
    email_normalized: email,
    x_handle_normalized: analysis.x_handle_normalized,
    consent_version: body.consentVersion,
    consent_at: new Date().toISOString(),
    board_opt_in: body.boardOptIn === true,
  });

  if (error) return NextResponse.json({ error: 'could_not_save' }, { status: 500 });

  await track('lead_registered', undefined, { eventId: analysis.event_id });
  if (body.boardOptIn === true) {
    await track('board_opt_in', undefined, { eventId: analysis.event_id });
  }

  return NextResponse.json({ ok: true });
}
