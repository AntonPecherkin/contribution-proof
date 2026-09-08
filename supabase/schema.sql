-- Contribution Proof — complete schema.
-- Generated from supabase/migrations/. Paste this whole file into the Supabase SQL
-- editor on a fresh project and run it once. Re-running fails loudly rather than
-- silently duplicating, which is intentional.

-- ─────────────────────────────────────────────────────────────────────────
-- 0001_init.sql
-- ─────────────────────────────────────────────────────────────────────────
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
  status text not null,
  error_class text,
  provider text, provider_snapshot_id text,
  started_at timestamptz, completed_at timestamptz,
  eligible_post_count int, evidence_band text,
  posts_technology int, views_total bigint, active_weeks int,
  comp_relevance int, comp_explanation int, comp_consistency int, comp_response int,
  score_total int, topics jsonb, narrative text, opportunities jsonb,
  market_relevance numeric, smart_amplification int,
  cache_expires_at timestamptz,
  created_at timestamptz not null default now()
);

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

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table rate_limits (
  bucket text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id),
  name text not null,
  props jsonb,
  session_id text,
  created_at timestamptz not null default now()
);

insert into events (id, slug, name)
values ('00000000-0000-4000-8000-000000000001', 'hackathon-2026', 'Contribution Proof Hackathon');

insert into settings (key, value) values
  ('analysis_enabled', 'true'::jsonb),
  ('turnstile_enabled', 'false'::jsonb),
  ('primary_provider', '"brightdata"'::jsonb),
  ('demo_mode', 'false'::jsonb),
  ('max_analyses_per_event', '500'::jsonb),
  ('per_ip_hourly_cap', '10'::jsonb);

-- ─────────────────────────────────────────────────────────────────────────
-- 0002_default_provider.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 0001 seeded 'brightdata' as the default provider. Measurement showed that provider
-- returns no post content, and twitterapi.io replaced it (see docs/SPEC.md). 0001 is
-- already applied, so this corrects the seeded value forward rather than editing it.
update settings
set value = '"twitterapi"'::jsonb, updated_at = now()
where key = 'primary_provider' and value = '"brightdata"'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────
-- 0003_rate_limit_function.sql
-- ─────────────────────────────────────────────────────────────────────────
create function check_and_increment_rate_limits(
  p_event_bucket text,
  p_ip_bucket text,
  p_handle_bucket text,
  p_event_cap integer,
  p_ip_cap integer,
  p_handle_cap integer,
  p_window_start timestamptz
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  next_count integer;
  breach_reason text;
begin
  -- The exception block is a subtransaction. A later breach rolls back every
  -- earlier upsert, so rejected requests cannot extend any lockout.
  begin
    insert into public.rate_limits as current_bucket (bucket, count, window_start)
    values (p_event_bucket, 1, p_window_start)
    on conflict (bucket) do update set count = current_bucket.count + 1
    returning count into next_count;

    if next_count > p_event_cap then
      raise exception using errcode = 'P0001', message = 'event';
    end if;

    insert into public.rate_limits as current_bucket (bucket, count, window_start)
    values (p_ip_bucket, 1, p_window_start)
    on conflict (bucket) do update set count = current_bucket.count + 1
    returning count into next_count;

    if next_count > p_ip_cap then
      raise exception using errcode = 'P0001', message = 'ip';
    end if;

    insert into public.rate_limits as current_bucket (bucket, count, window_start)
    values (p_handle_bucket, 1, p_window_start)
    on conflict (bucket) do update set count = current_bucket.count + 1
    returning count into next_count;

    if next_count > p_handle_cap then
      raise exception using errcode = 'P0001', message = 'handle';
    end if;
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics breach_reason = message_text;
      return breach_reason;
  end;

  return 'allowed';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 0004_provider_back_to_brightdata.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 0002 pointed primary_provider at a provider that has since been withdrawn: measurement
-- showed the alternative failed for exactly the small accounts a developer event attracts,
-- and carried no eligibility indicators. See docs/SPEC.md and the C3 brief.
--
-- 0002 is already applied, so this corrects the value forward rather than editing it.
update settings
set value = '"brightdata"'::jsonb, updated_at = now()
where key = 'primary_provider' and value <> '"brightdata"'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────
-- 0005_result_payload.sql
-- ─────────────────────────────────────────────────────────────────────────
-- The rendered result is stored whole rather than spread across columns.
--
-- There are now two result shapes - a scored analysis and a profile signal - and they do not
-- share a column set. Storing the payload keeps the poll endpoint a single read and means a
-- change to what the result contains is not a migration.
--
-- The scalar columns above it stay: the board aggregates over them, and a jsonb scan for a
-- leaderboard would be the wrong tool.
alter table analyses add column if not exists result jsonb;
alter table analyses add column if not exists result_kind text;

