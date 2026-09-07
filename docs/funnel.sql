-- Funnel analytics for one event.
-- In psql, set the event UUID before running this file:
--   \set event_id '00000000-0000-4000-8000-000000000001'

-- Landing -> handle -> lead -> completed conversion, by distinct browser session.
with funnel as (
  select
    count(distinct session_id) filter (where name = 'landing_viewed') as landing,
    count(distinct session_id) filter (where name = 'handle_submitted') as handle,
    count(distinct session_id) filter (where name = 'lead_registered') as lead,
    count(distinct session_id) filter (where name = 'analysis_completed') as completed
  from analytics_events
  where event_id = :'event_id'::uuid
)
select
  landing,
  handle,
  round(100.0 * handle / nullif(landing, 0), 1) as handle_conversion_pct,
  lead,
  round(100.0 * lead / nullif(landing, 0), 1) as lead_conversion_pct,
  completed,
  round(100.0 * completed / nullif(landing, 0), 1) as completed_conversion_pct
from funnel;

-- Completion rate among sessions where analysis started.
with completion as (
  select
    count(distinct session_id) filter (where name = 'analysis_started') as started,
    count(distinct session_id) filter (where name = 'analysis_completed') as completed
  from analytics_events
  where event_id = :'event_id'::uuid
)
select
  started,
  completed,
  round(100.0 * completed / nullif(started, 0), 1) as completion_rate_pct
from completion;

-- Completion latency distribution, split by cache lane.
with latency as (
  select
    props ->> 'lane' as lane,
    props ->> 'latency_bucket' as latency_bucket,
    count(*) as completions
  from analytics_events
  where event_id = :'event_id'::uuid
    and name = 'analysis_completed'
  group by props ->> 'lane', props ->> 'latency_bucket'
)
select
  lane,
  latency_bucket,
  completions,
  round(100.0 * completions / sum(completions) over (partition by lane), 1) as lane_share_pct
from latency
order by lane, latency_bucket;

-- Board opt-in rate among registered leads.
with opt_in as (
  select
    count(distinct session_id) filter (where name = 'lead_registered') as registered,
    count(distinct session_id) filter (where name = 'board_opt_in') as opted_in
  from analytics_events
  where event_id = :'event_id'::uuid
)
select
  registered,
  opted_in,
  round(100.0 * opted_in / nullif(registered, 0), 1) as opt_in_rate_pct
from opt_in;

-- Share generation and completion rates among sessions that viewed a result.
with sharing as (
  select
    count(distinct session_id) filter (where name = 'result_viewed') as result_viewers,
    count(distinct session_id) filter (where name = 'share_generated') as generated,
    count(distinct session_id) filter (where name = 'share_completed') as completed
  from analytics_events
  where event_id = :'event_id'::uuid
)
select
  result_viewers,
  generated,
  round(100.0 * generated / nullif(result_viewers, 0), 1) as generation_rate_pct,
  completed,
  round(100.0 * completed / nullif(result_viewers, 0), 1) as completion_rate_pct
from sharing;
