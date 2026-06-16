-- sync_group_round_count must not set round_count below 1 while a group is still
-- being filled during setup (compute_group_round_count returns 0 for <2 teams).

create or replace function public.sync_group_round_count(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text;
  v_team_count int;
  v_round_robin_count int;
begin
  if public.group_uses_rbbf_template(p_group_id) then
    select l.scope, g.round_robin_count
    into v_scope, v_round_robin_count
    from public.groups g
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where g.id = p_group_id;

    update public.groups g
    set round_count = case
      when v_scope = 'regional' then 14
      when coalesce(v_round_robin_count, 2) >= 3 then 21
      else 14
    end
    where g.id = p_group_id;
    return;
  end if;

  select count(*) into v_team_count
  from public.teams t
  where t.group_id = p_group_id;

  if v_team_count < 2 then
    return;
  end if;

  select g.round_robin_count into v_round_robin_count
  from public.groups g
  where g.id = p_group_id;

  update public.groups g
  set round_count = public.compute_group_round_count(
    v_team_count,
    coalesce(v_round_robin_count, 2)
  )
  where g.id = p_group_id;
end;
$$;
