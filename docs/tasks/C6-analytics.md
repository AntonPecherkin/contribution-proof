# C6 — Funnel analytics

**Wave:** 1 · **Blocked by:** C0 · **Est:** 45m

## Goal

One insert, one query surface. Enough to answer "did this event work?" the next morning
without adding an analytics vendor, a cookie banner, or a single piece of personal data.

## Files

- Create: `src/lib/analytics.ts`
- Create: `tests/analytics.test.ts`
- Create: `docs/funnel.sql`

## Produces

```ts
export type AnalyticsEvent =
  | 'landing_viewed' | 'handle_submitted' | 'analysis_started'
  | 'lead_registered' | 'analysis_completed' | 'analysis_failed'
  | 'result_viewed' | 'board_opt_in'
  | 'share_generated' | 'share_completed' | 'opportunity_clicked';

export async function track(
  name: AnalyticsEvent,
  props?: Record<string, string | number | boolean>,
  ctx?: { eventId?: string; sessionId?: string },
): Promise<void>;
```

## Spec

`track` inserts one row into `analytics_events`. It is **fire-and-forget**: it must never
throw, never reject, and never delay the caller. Analytics failing is not a reason for a
participant to see an error — catch everything, log, move on.

**Props are non-PII only.** No email, no handle, no IP, no post text. Enforce this in code
rather than by convention: keep a small allowlist of prop keys and drop anything else, so a
future caller cannot leak a field by accident.

Allowed prop keys:

```
latency_bucket   '0-2s' | '2-10s' | '10-30s' | '30-60s' | '60s+'
lane             'warm' | 'sync' | 'snapshot'
evidence_band    'good' | 'limited' | 'directional' | 'none'
error_class      the ProfileResult error classes, plus 'llm'
provider         'brightdata' | 'twitterapi' | 'mock'
score_bucket     '0-200' | '200-400' | '400-600' | '600-800' | '800-1000'
opportunity_rank 1 | 2 | 3
```

`lane` earns its place: it is how we tell, live during the event, whether the pre-warm
actually worked. A `warm` share that collapses means the cache is missing and the queue is
about to slow down.

`sessionId` is a random client-generated id held in `sessionStorage`. It is not a user id,
it does not persist across sessions, and it is never joined to a participant row.

**`docs/funnel.sql`** — write the queries now, while the event names are fresh:
landing → handle → lead → completed conversion; completion rate; latency distribution by
lane; opt-in rate; share rate.

## Acceptance

```bash
npx vitest run tests/analytics.test.ts
```

Cover: a well-formed insert; a disallowed prop key silently dropped; a database error
swallowed without throwing; `track` resolving even when the client rejects.

## Constraints

- Server-only. `import 'server-only'`.
- Never throw. Ever. Wrap the whole body.
- Do not add an analytics SDK.
