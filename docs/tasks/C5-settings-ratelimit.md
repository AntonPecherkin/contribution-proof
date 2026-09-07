# C5 — Runtime settings and rate limiting

**Wave:** 1 · **Blocked by:** C0 · **Est:** 1–2h

## Goal

Two small database-backed modules. Together they are the event-day control panel: they let a
human standing at a booth change the application's behaviour from a phone, with no deploy.

## Files

- Create: `src/lib/settings.ts`, `src/lib/ratelimit.ts`
- Create: `tests/settings.test.ts`, `tests/ratelimit.test.ts`

## Produces

```ts
// settings.ts
export type Settings = {
  analysisEnabled: boolean;
  turnstileEnabled: boolean;
  primaryProvider: 'brightdata' | 'twitterapi' | 'mock';
  demoMode: boolean;
  maxAnalysesPerEvent: number;
  perIpHourlyCap: number;
};
export async function getSettings(): Promise<Settings>;
export function clearSettingsCache(): void;    // tests only

// ratelimit.ts
export type LimitResult = { allowed: true } | { allowed: false; reason: 'ip' | 'handle' | 'event' };
export async function checkAndIncrement(opts: {
  ip: string; handle: string; eventId: string;
}): Promise<LimitResult>;
```

## Spec

**`getSettings`** reads the `settings` table and caches for **30 seconds** in module scope.
The cache is what makes this cheap enough to call per request; the 30-second bound is what
makes a booth-side change take effect fast enough to be useful.

**Defaults matter more than they look.** If the table is missing, unreachable, or a row is
absent, return safe defaults rather than throwing — the application must not fall over
because a settings read failed:

```
analysisEnabled: true      turnstileEnabled: false     primaryProvider: 'brightdata'
demoMode: false            maxAnalysesPerEvent: 500    perIpHourlyCap: 10
```

Coerce defensively. A human types into this table on a phone under pressure — `"true"`,
`"TRUE"`, and `1` all mean true; an unparseable value falls back to the default rather than
crashing a request.

**`checkAndIncrement`** enforces three caps against the `rate_limits` table, using hourly
buckets keyed `ip:<sha256(ip)>:<YYYY-MM-DDTHH>`, `handle:<handle>:<YYYY-MM-DDTHH>`, and
`event:<eventId>`. Hash the IP — a raw address is personal data and this table has no reason
to hold one.

Check in order **event → ip → handle** and return the first breach. Increment only when the
call is allowed, so a rejected request cannot extend its own lockout.

Use a single atomic upsert per bucket (`insert ... on conflict do update set count = count + 1`).
Read-then-write races under booth load and will silently over-admit.

## Acceptance

```bash
npx vitest run tests/settings.test.ts tests/ratelimit.test.ts
```

Cover:
- settings parse correctly from a well-formed table
- a missing table returns defaults and does not throw
- a garbage value falls back to that key's default
- the cache serves a second call without a second query, and expires after 30 s
- `checkAndIncrement` allows under the cap, denies at it, and reports the right `reason`
- a denied call does not increment
- buckets roll over at the hour boundary
- the stored IP bucket contains no raw IP address

Stub the database client; no live connection in tests.

## Database access

Import `getDb()` from `src/lib/db.ts` and call it inside your functions - never at module
scope. The client is memoized on first use, so a test can set `process.env` before the first
call and use `resetDbForTests()` between cases. This is the same rule the provider adapters
follow, and it is why your tests can run with no credentials.

## Constraints

- Server-only. Add `import 'server-only'` to both.
- Do not import a provider or the scoring module. These two files know nothing about X.
- Do not add Redis or Upstash. A Postgres counter is correct at this scale.
