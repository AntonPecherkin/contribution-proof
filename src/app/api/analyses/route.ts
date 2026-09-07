import { after, NextResponse } from 'next/server';

import { runAnalysis } from '../../../lib/analysis-runner';
import { track } from '../../../lib/analytics';
import { getDb } from '../../../lib/db';
import { normalizeHandle } from '../../../lib/normalize';
import { checkAndIncrement } from '../../../lib/ratelimit';
import { getSettings } from '../../../lib/settings';

/**
 * Start an analysis.
 *
 * Called from the landing screen, before the email step, so that collection runs during the
 * 15-20 seconds someone spends typing an address. That is why consent is collected here and
 * not later.
 */

const EVENT_SLUG = 'hackathon-2026';

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(request: Request): Promise<NextResponse> {
  const settings = await getSettings();
  if (!settings.analysisEnabled) {
    return NextResponse.json({ error: 'paused' }, { status: 503 });
  }

  let body: { handle?: unknown; consentVersion?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const handle = typeof body.handle === 'string' ? normalizeHandle(body.handle) : null;
  if (!handle) return NextResponse.json({ error: 'invalid_handle' }, { status: 400 });
  if (typeof body.consentVersion !== 'string' || !body.consentVersion) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  }

  const db = getDb();
  const { data: event } = await db
    .from('events')
    .select('id')
    .eq('slug', EVENT_SLUG)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: 'no_event' }, { status: 500 });

  // The partial unique index does the single-flighting. A live or freshly complete row is
  // returned as-is: a duplicate submission must not pay a second provider bill, and a
  // complete row inside its cache window is the warm lane.
  const { data: existing } = await db
    .from('analyses')
    .select('id,status')
    .eq('event_id', event.id)
    .eq('x_handle_normalized', handle)
    .in('status', ['queued', 'fetching', 'scoring', 'complete'])
    .maybeSingle();

  if (existing) {
    await track('analysis_started', { lane: 'warm' }, { eventId: event.id });
    return NextResponse.json({ id: existing.id, cached: true });
  }

  const limit = await checkAndIncrement({ ip: clientIp(request), handle, eventId: event.id });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'rate_limited', reason: limit.reason }, { status: 429 });
  }

  const { data: created, error } = await db
    .from('analyses')
    .insert({
      event_id: event.id,
      x_handle_normalized: handle,
      status: 'queued',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !created) {
    return NextResponse.json({ error: 'could_not_start' }, { status: 500 });
  }

  await track('analysis_started', { lane: 'cold' }, { eventId: event.id });
  // Returns immediately; the platform finishes the work after the response.
  after(() => runAnalysis(created.id));

  return NextResponse.json({ id: created.id, cached: false });
}
