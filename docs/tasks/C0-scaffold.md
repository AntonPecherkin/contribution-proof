# C0 — Repository scaffold

**Wave:** 0 · **Blocked by:** nothing · **Est:** 1–2h

## Goal

Turn this repository into a running, deployable Next.js application with CI and a database
schema, without disturbing the files already here.

## Do not clobber

`AGENTS.md`, `CLAUDE.md`, `README.md`, `LICENSE`, `NOTICE`, `.gitignore`, `.env.example`,
and `docs/**` already exist and are correct. If a scaffolding tool wants to overwrite one,
keep the existing file. In particular, **do not let `create-next-app` replace `README.md`
or `.gitignore`.**

## Files

- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`,
  `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (placeholder only)
- Create: `.github/workflows/ci.yml`
- Create: `supabase/migrations/0001_init.sql`
- Create: `src/lib/db.ts`

## Spec

**App:** Next.js 15, App Router, TypeScript strict, Tailwind. `src/app/page.tsx` is a
placeholder — Claude owns the real pages, so leave a single heading and nothing else.

**CI** (`.github/workflows/ci.yml`) runs on every push and PR: `npm ci`, `npm run lint`,
`npx tsc --noEmit`, `npx vitest run`. It must pass on an empty test suite.

**`src/lib/db.ts`** exports a server-only Supabase client built from `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. Add `import 'server-only'` at the top. There is deliberately
no browser client and no anon key — do not add one.

**Migration `0001_init.sql`** creates exactly this:

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  starts_at timestamptz, ends_at timestamptz,
  active boolean not null default true
);

create table analyses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  x_handle_normalized text not null,
  status text not null,          -- queued | fetching | scoring | complete | failed | archived
  error_class text,              -- invalid_handle | private | empty | provider | llm | timeout
  provider text, provider_snapshot_id text,
  started_at timestamptz, completed_at timestamptz,
  eligible_post_count int, evidence_band text,
  posts_technology int, views_total bigint, active_weeks int,
  comp_relevance int, comp_explanation int, comp_consistency int, comp_response int,
  score_total int, topics jsonb, narrative text, opportunities jsonb,
  market_relevance numeric, smart_amplification int,   -- reserved, unused
  cache_expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Load-bearing: gives single-flight and idempotency for free.
create unique index analyses_live_uniq on analyses (event_id, x_handle_normalized)
  where status in ('queued','fetching','scoring','complete');

create table participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  analysis_id uuid references analyses(id),
  email_normalized text not null,
  x_handle_normalized text not null,
  consent_version text not null,
  consent_at timestamptz not null,
  board_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);
create index participants_event_email on participants (event_id, email_normalized);

create table settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
create table rate_limits (bucket text primary key, count int not null default 0, window_start timestamptz not null default now());
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id),
  name text not null, props jsonb, session_id text,
  created_at timestamptz not null default now()
);
```

Then seed one event row and these settings keys:
`analysis_enabled=true`, `turnstile_enabled=false`, `primary_provider="brightdata"`,
`demo_mode=false`, `max_analyses_per_event=500`, `per_ip_hourly_cap=10`.

## Acceptance

- `npm run dev` serves the placeholder page.
- `npm run lint`, `npx tsc --noEmit`, `npx vitest run` all pass.
- CI is green on the first push.
- The migration applies cleanly to a fresh database, and re-applying it fails loudly rather
  than silently duplicating.

## Constraints

- No `NEXT_PUBLIC_SUPABASE_*` variable. No browser database client.
- Do not add a state manager, an ORM, a component library, or a job queue.
- Do not edit files listed under "Do not clobber".
