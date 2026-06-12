-- Score-entry VP metadata: mis-seating and effective board count for VP lookup

alter table public.matches
  add column if not exists mis_seating boolean not null default false,
  add column if not exists vp_board_count int,
  add column if not exists selected_board_count int;

alter table public.matches
  add constraint matches_vp_board_count_positive
    check (vp_board_count is null or vp_board_count > 0);

alter table public.matches
  add constraint matches_selected_board_count_valid
    check (selected_board_count is null or selected_board_count in (28, 32));

create or replace function public.lookup_vp_for_match(
  p_match_id uuid,
  p_imps_home numeric,
  p_imps_away numeric
)
returns table (vp_home numeric, vp_away numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_board_count int;
  v_net numeric;
  v_vp_home numeric;
  v_vp_away numeric;
begin
  select m.group_id, coalesce(m.vp_board_count, m.board_count)
  into v_group_id, v_board_count
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  v_net := p_imps_home - p_imps_away;

  select r.vp_home, r.vp_away
  into v_vp_home, v_vp_away
  from public.vp_tables vt
  join public.vp_table_rows r on r.vp_table_id = vt.id
  where vt.group_id = v_group_id
    and vt.board_count = v_board_count
    and v_net >= r.imp_min
    and v_net <= r.imp_max
  limit 1;

  if v_vp_home is null then
    raise exception 'No VP band for net IMP % (group %, boards %)', v_net, v_group_id, v_board_count;
  end if;

  vp_home := v_vp_home;
  vp_away := v_vp_away;
  return next;
end;
$$;
