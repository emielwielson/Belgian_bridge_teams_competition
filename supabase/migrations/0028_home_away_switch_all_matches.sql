-- Make home/away switching available for all unplayed matches.
-- Mirror-round metadata remains for UI hints, but eligibility is no longer restricted to mirror rounds.

create or replace function public.match_mirror_switch_context(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_group public.groups%rowtype;
  v_team_count int;
  v_first_leg_round int;
  v_first_leg public.matches%rowtype;
  v_needs_switch boolean := false;
  v_is_mirror_round boolean := false;
  v_has_first_leg boolean := false;
begin
  select * into v_match
  from public.matches m
  where m.id = p_match_id;

  if not found then
    return null;
  end if;

  select * into v_group
  from public.groups g
  where g.id = v_match.group_id;

  select count(*)::int into v_team_count
  from public.teams t
  where t.group_id = v_match.group_id;

  v_is_mirror_round := v_match.round between 8 and 14
    and v_group.round_count in (14, 21)
    and v_team_count = 8;

  if v_match.played_at is not null then
    return jsonb_build_object(
      'eligible', false,
      'needs_switch', false,
      'is_mirror_round', v_is_mirror_round,
      'first_leg_round', null,
      'round_count', v_group.round_count,
      'team_count', v_team_count
    );
  end if;

  if v_is_mirror_round then
    v_first_leg_round := v_match.round - 7;

    select * into v_first_leg
    from public.matches m
    where m.group_id = v_match.group_id
      and m.round = v_first_leg_round
      and (
        (m.home_team_id = v_match.home_team_id and m.away_team_id = v_match.away_team_id)
        or (m.home_team_id = v_match.away_team_id and m.away_team_id = v_match.home_team_id)
      )
    limit 1;

    if found then
      v_has_first_leg := true;
      v_needs_switch := v_first_leg.home_team_id = v_match.home_team_id
        and v_first_leg.away_team_id = v_match.away_team_id;
    end if;
  end if;

  return jsonb_build_object(
    'eligible', true,
    'needs_switch', v_needs_switch,
    'is_mirror_round', v_is_mirror_round,
    'first_leg_round', case when v_is_mirror_round then to_jsonb(v_first_leg_round) else null end,
    'round_count', v_group.round_count,
    'team_count', v_team_count,
    'first_leg', case
      when v_has_first_leg and v_is_mirror_round then jsonb_build_object(
        'home_team_id', v_first_leg.home_team_id,
        'away_team_id', v_first_leg.away_team_id
      )
      else null
    end
  );
end;
$$;
