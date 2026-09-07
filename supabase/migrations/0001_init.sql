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
