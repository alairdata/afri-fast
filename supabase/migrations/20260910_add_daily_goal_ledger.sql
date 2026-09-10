-- Daily Goal Ledger: one row per (user, day) with the day's actual calories eaten, the calorie
-- goal that was ACTUALLY ACTIVE on that specific day (resolved from goal_history, not inferred
-- live by every consumer separately), and a status. This is the single source of truth for
-- "was this day on target" -- Days on Target, streaks, and Momentum's calorie scoring should
-- read from this table instead of each independently resolving goal_history and risking a
-- different bug in each implementation (which is exactly what kept happening).
--
-- Refreshed by refresh_daily_goal_ledger(), scheduled hourly via pg_cron at the bottom of this
-- file. Each run recomputes the full ledger and upserts -- a later run always overwrites an
-- earlier one for the same (user, day), so there's nothing to "merge," just the latest true
-- state each hour.

create table if not exists daily_goal_ledger (
  user_id        uuid not null references profiles(id) on delete cascade,
  log_date       date not null,
  calories_eaten numeric not null default 0,
  calorie_goal   numeric,
  status         text, -- 'under' | 'on_target' | 'over' | null (no goal known for that day)
  updated_at     timestamptz not null default now(),
  primary key (user_id, log_date)
);

create index if not exists idx_daily_goal_ledger_user_date on daily_goal_ledger(user_id, log_date);

-- meals.date is stored as TEXT, and inconsistently -- some rows are ISO-prefixed
-- ("2026-09-07..."), others are JS Date.prototype.toDateString() format ("Thu Sep 10 2026", the
-- format the app writes today). Mirrors the client's own normalizeMealDate() patch (see
-- FastingApp.jsx) so both formats resolve to the same real calendar date instead of one of them
-- silently failing to parse. Anything that matches neither pattern returns null rather than
-- guessing wrong.
create or replace function parse_meal_date(p_date text)
returns date
language plpgsql
immutable
as $$
begin
  if p_date is null then
    return null;
  end if;
  if p_date ~ '^\d{4}-\d{2}-\d{2}' then
    return substring(p_date from 1 for 10)::date;
  end if;
  if p_date ~ '^[A-Za-z]{3} [A-Za-z]{3} \d{2} \d{4}$' then
    return to_date(substring(p_date from 5), 'Mon DD YYYY');
  end if;
  return null;
exception when others then
  return null;
end;
$$;

-- Mirrors src/lib/goalHistory.js's resolveGoalForDate exactly, including the same-day tie-break
-- fix (prefer the LAST entry in array order among several changes made the same calendar day,
-- not the first) -- ordinality gives each jsonb array element its 1-based position, used as the
-- tie-breaker the same way the JS version relies on array/insertion order.
create or replace function resolve_daily_calorie_goal(p_goal_history jsonb, p_date date, p_current numeric)
returns numeric
language sql
stable
as $$
  select coalesce(
    (
      select (entry->>'dailyCalorieGoal')::numeric
      from jsonb_array_elements(coalesce(p_goal_history, '[]'::jsonb)) with ordinality as t(entry, ord)
      where entry->>'dailyCalorieGoal' is not null
        and (entry->>'from')::date <= p_date
      order by (entry->>'from')::date desc, ord desc
      limit 1
    ),
    (
      select (entry->>'dailyCalorieGoal')::numeric
      from jsonb_array_elements(coalesce(p_goal_history, '[]'::jsonb)) with ordinality as t(entry, ord)
      where entry->>'dailyCalorieGoal' is not null
      order by (entry->>'from')::date asc, ord asc
      limit 1
    ),
    p_current
  );
$$;

-- Full recompute + upsert every run -- simplest correct option at this app's data scale, and
-- avoids incremental-update bugs (a missed edge case that only breaks the "next" partial refresh).
-- Same 70%-115% "on target" band already used everywhere else in the app (Days on Target,
-- weeklyHitRates), so the status column here agrees with what those already mean.
create or replace function refresh_daily_goal_ledger()
returns void
language sql
as $$
  insert into daily_goal_ledger (user_id, log_date, calories_eaten, calorie_goal, status, updated_at)
  select
    d.user_id,
    d.log_date,
    d.calories_eaten,
    resolve_daily_calorie_goal(p.goal_history, d.log_date, p.daily_calorie_goal) as calorie_goal,
    case
      when resolve_daily_calorie_goal(p.goal_history, d.log_date, p.daily_calorie_goal) is null
        or resolve_daily_calorie_goal(p.goal_history, d.log_date, p.daily_calorie_goal) <= 0
        then null
      when d.calories_eaten < resolve_daily_calorie_goal(p.goal_history, d.log_date, p.daily_calorie_goal) * 0.7
        then 'under'
      when d.calories_eaten > resolve_daily_calorie_goal(p.goal_history, d.log_date, p.daily_calorie_goal) * 1.15
        then 'over'
      else 'on_target'
    end as status,
    now() as updated_at
  from (
    select
      user_id,
      parse_meal_date(date) as log_date,
      sum(calories) as calories_eaten
    from meals
    where parse_meal_date(date) is not null
    group by user_id, parse_meal_date(date)
  ) d
  join profiles p on p.id = d.user_id
  on conflict (user_id, log_date)
  do update set
    calories_eaten = excluded.calories_eaten,
    calorie_goal   = excluded.calorie_goal,
    status         = excluded.status,
    updated_at     = excluded.updated_at;
$$;

-- Hourly schedule. pg_cron is a Postgres extension already available on Supabase; this just
-- turns it on and registers the job. Re-running this migration is safe -- unschedule-then-
-- schedule avoids a duplicate job if it's ever applied twice.
create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'refresh_daily_goal_ledger_hourly';

select cron.schedule(
  'refresh_daily_goal_ledger_hourly',
  '0 * * * *', -- top of every hour
  $$select refresh_daily_goal_ledger();$$
);

-- Populate it immediately so there's data to look at without waiting up to an hour for the
-- first scheduled run.
select refresh_daily_goal_ledger();

-- RLS is on for this table (project default), but with no policy every client read was silently
-- returning zero rows -- the app fell back to live computation everywhere, unnoticed until the
-- share card's goal number didn't match the ledger's known-correct value for a past date. The
-- write side (refresh_daily_goal_ledger via pg_cron) was never affected -- that runs with
-- elevated privileges that bypass RLS -- so this went undetected until reads were checked
-- directly. Read-only: nothing but the owning row's user should ever need to write here client-side.
-- CREATE POLICY has no IF NOT EXISTS clause, so drop-then-create keeps this migration safe to
-- re-run, matching the same pattern used for the cron job above.
drop policy if exists "Users can view their own goal ledger" on daily_goal_ledger;

create policy "Users can view their own goal ledger"
  on daily_goal_ledger for select
  using (auth.uid() = user_id);
