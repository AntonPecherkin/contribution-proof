import 'server-only';

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
  lane: new Set(['warm', 'live']),
  evidence_band: new Set(['good', 'limited', 'directional', 'none']),
  error_class: new Set(['invalid_handle', 'private', 'empty', 'provider', 'timeout', 'llm']),
  provider: new Set(['twitterapi', 'mock']),
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

export async function track(
  name: AnalyticsEvent,
  props?: Record<string, PropValue>,
  ctx?: { eventId?: string; sessionId?: string },
): Promise<void> {
  try {
    const request = getDb()
      .from('analytics_events')
      .insert({
        name,
        props: sanitizeProps(props),
        event_id: ctx?.eventId ?? null,
        session_id: ctx?.sessionId ?? null,
      });

    void Promise.resolve(request).then(
      ({ error }) => {
        if (error) {
          logFailure(error);
        }
      },
      logFailure,
    ).catch(logFailure);
  } catch (error) {
    logFailure(error);
  }
}
