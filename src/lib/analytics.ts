import 'server-only';

import { after } from 'next/server';

import { getDb } from './db';

export type AnalyticsEvent =
  | 'landing_viewed'
  | 'handle_submitted'
  | 'analysis_started'
  | 'lead_registered'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'result_viewed'
  | 'board_opt_in'
  | 'share_generated'
  | 'share_completed'
  | 'opportunity_clicked';

type PropValue = string | number | boolean;

const allowedPropValues: Record<string, ReadonlySet<PropValue>> = {
  latency_bucket: new Set(['0-2s', '2-10s', '10-30s', '30-60s', '60s+']),
  lane: new Set(['warm', 'cold']),
  evidence_band: new Set(['good', 'limited', 'directional', 'none']),
  error_class: new Set(['invalid_handle', 'private', 'empty', 'provider', 'timeout', 'llm']),
  provider: new Set(['brightdata', 'mock']),
  score_bucket: new Set(['0-200', '200-400', '400-600', '600-800', '800-1000']),
  opportunity_rank: new Set([1, 2, 3]),
};

function sanitizeProps(props: Record<string, PropValue> | undefined): Record<string, PropValue> {
  if (!props) {
    return {};
  }

  const sanitized: Record<string, PropValue> = {};
  for (const [key, value] of Object.entries(props)) {
    if (allowedPropValues[key]?.has(value)) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function logFailure(error: unknown): void {
  try {
    console.error('Analytics event was not recorded', error);
  } catch {
    // Logging must not turn an analytics failure into a participant-facing failure.
  }
}

async function write(
  name: AnalyticsEvent,
  props: Record<string, PropValue> | undefined,
  ctx: { eventId?: string; sessionId?: string } | undefined,
): Promise<void> {
  try {
    const { error } = await getDb()
      .from('analytics_events')
      .insert({
        name,
        props: sanitizeProps(props),
        event_id: ctx?.eventId ?? null,
        session_id: ctx?.sessionId ?? null,
      });

    if (error) {
      logFailure(error);
    }
  } catch (error) {
    logFailure(error);
  }
}

export async function track(
  name: AnalyticsEvent,
  props?: Record<string, PropValue>,
  ctx?: { eventId?: string; sessionId?: string },
): Promise<void> {
  // Fire-and-forget must not mean fire-and-hope. A serverless function is frozen once its
  // response is sent, so a promise that is merely un-awaited can be killed mid-insert - and
  // the events most likely to be lost are the last ones in a request, which is exactly where
  // lead_registered lives. `after` hands the work to the platform to finish post-response.
  //
  // Outside a request scope - scripts, tests - `after` throws, so fall back to detaching.
  try {
    after(() => write(name, props, ctx));
  } catch {
    void write(name, props, ctx);
  }
}
