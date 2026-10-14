-- Zweiffel APM 1/2 and 2A use their own match-date calendars (APM @ 14:00;
-- 2A/APM have 15 rounds including 2027-02-23). Other Zweiffel divisions keep
-- the region-wide Honneur evening calendar (division_id null).

create or replace function public.resolve_group_match_dates_division_id(p_group_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_division_name text;
  v_division_id uuid;
begin
  select d.name, d.id into v_division_name, v_division_id
  from public.groups g
  join public.divisions d on d.id = g.division_id
  where g.id = p_group_id;

  if v_division_name in (
    'Honor',
    'Honor Division',
    '1st Division',
    'APM 1',
    'APM 2',
    '2A'
  ) then
    return v_division_id;
  end if;

  return null;
end;
$$;
