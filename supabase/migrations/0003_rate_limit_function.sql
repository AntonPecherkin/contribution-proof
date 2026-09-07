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
