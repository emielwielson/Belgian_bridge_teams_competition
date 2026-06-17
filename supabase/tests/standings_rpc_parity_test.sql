-- Assert standings_for_groups RPC matches standings_group view output.

do $$
declare
  v_group_id uuid;
  v_rpc_count int;
  v_view_count int;
  v_mismatch int;
begin
  select g.id into v_group_id
  from public.groups g
  limit 1;

  if v_group_id is null then
    raise exception 'No groups found — run seed.sql first';
  end if;

  select count(*) into v_rpc_count
  from public.standings_for_groups(array[v_group_id]);

  select count(*) into v_view_count
  from public.standings_group
  where group_id = v_group_id;

  if v_rpc_count <> v_view_count then
    raise exception 'Row count mismatch for group %: rpc=% view=%',
      v_group_id, v_rpc_count, v_view_count;
  end if;

  select count(*) into v_mismatch
  from public.standings_for_groups(array[v_group_id]) rpc
  full outer join public.standings_group v
    on v.group_id = rpc.group_id
    and v.team_id = rpc.team_id
  where v.group_id = v_group_id
    and (
      v.team_name is distinct from rpc.team_name
      or v.match_vp_total is distinct from rpc.match_vp_total
      or v.penalty_vp is distinct from rpc.penalty_vp
      or v.vp_total is distinct from rpc.vp_total
    );

  if v_mismatch > 0 then
    raise exception 'standings_for_groups output differs from standings_group for group %',
      v_group_id;
  end if;
end $$;

select 'standings_rpc_parity_test passed' as result;
