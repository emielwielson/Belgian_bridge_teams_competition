-- Count max matches per day on Brussels calendar dates (not UTC).

create or replace function public.enforce_max_matches_per_day_per_team()
returns trigger
language plpgsql
as $$
declare
  v_max int;
  v_home_count int;
  v_away_count int;
  v_match_day date;
begin
  select g.max_matches_per_day_per_team into v_max
  from public.groups g
  where g.id = new.group_id;

  if v_max is null then
    return new;
  end if;

  v_match_day := (new.datetime at time zone 'Europe/Brussels')::date;

  select count(*) into v_home_count
  from public.matches m
  where m.group_id = new.group_id
    and m.id is distinct from new.id
    and (m.home_team_id = new.home_team_id or m.away_team_id = new.home_team_id)
    and (m.datetime at time zone 'Europe/Brussels')::date = v_match_day;

  if v_home_count >= v_max then
    raise exception 'Team exceeds max_matches_per_day_per_team on this date (home/away team)';
  end if;

  select count(*) into v_away_count
  from public.matches m
  where m.group_id = new.group_id
    and m.id is distinct from new.id
    and (m.home_team_id = new.away_team_id or m.away_team_id = new.away_team_id)
    and (m.datetime at time zone 'Europe/Brussels')::date = v_match_day;

  if v_away_count >= v_max then
    raise exception 'Team exceeds max_matches_per_day_per_team on this date (away team)';
  end if;

  return new;
end;
$$;
