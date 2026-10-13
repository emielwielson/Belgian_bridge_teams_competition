  -- Replace home/away switch with free-text match location change requests.

  -- ---------------------------------------------------------------------------
  -- Schema
  -- ---------------------------------------------------------------------------

  alter table public.matches
    add column if not exists location_override text;

  alter table public.matches
    drop constraint if exists matches_location_override_nonempty;
  alter table public.matches
    add constraint matches_location_override_nonempty
    check (
      location_override is null
      or length(trim(location_override)) > 0
    );

  create table public.match_location_change_requests (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null references public.matches (id) on delete cascade,
    status text not null default 'pending',
    proposed_location text not null,
    proposing_team_id uuid not null references public.teams (id) on delete restrict,
    proposed_by uuid references auth.users (id) on delete set null,
    responded_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    responded_at timestamptz,
    constraint match_location_change_requests_status_check
      check (status in ('pending', 'approved', 'rejected', 'cancelled')),
    constraint match_location_change_requests_location_nonempty
      check (length(trim(proposed_location)) > 0)
  );

  create unique index match_location_change_requests_one_pending_per_match
    on public.match_location_change_requests (match_id)
    where status = 'pending';

  create index match_location_change_requests_match_id_idx
    on public.match_location_change_requests (match_id);

  -- ---------------------------------------------------------------------------
  -- Venue resolution helper (mirrors web/lib/competition/team-location.ts)
  -- ---------------------------------------------------------------------------

  create or replace function public.resolve_team_match_location(p_team_id uuid)
  returns text
  language plpgsql
  stable
  security definer
  set search_path = public
  as $$
  declare
    v_team_location text;
    v_centralized text;
    v_competition_location text;
    v_address text;
    v_postal_code text;
    v_club_location text;
    v_parts text[];
  begin
    select
      nullif(trim(t.location), ''),
      nullif(trim(d.centralized_location), ''),
      nullif(trim(c.competition_location), ''),
      nullif(trim(c.address), ''),
      nullif(trim(c.postal_code), ''),
      nullif(trim(c.location), '')
    into
      v_team_location,
      v_centralized,
      v_competition_location,
      v_address,
      v_postal_code,
      v_club_location
    from public.teams t
    join public.clubs c on c.id = t.club_id
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    where t.id = p_team_id;

    if not found then
      return null;
    end if;

    if v_centralized is not null then
      return v_centralized;
    end if;

    if v_team_location is not null then
      return v_team_location;
    end if;

    if v_competition_location is not null then
      return v_competition_location;
    end if;

    v_parts := array[]::text[];
    if v_address is not null then
      v_parts := array_append(v_parts, v_address);
    end if;
    if v_postal_code is not null then
      v_parts := array_append(v_parts, v_postal_code);
    end if;
    if v_club_location is not null then
      v_parts := array_append(v_parts, v_club_location);
    end if;

    if cardinality(v_parts) = 0 then
      return null;
    end if;

    return array_to_string(v_parts, ' - ');
  end;
  $$;

  -- ---------------------------------------------------------------------------
  -- Helpers / view ACL
  -- ---------------------------------------------------------------------------

  create or replace function public.match_has_pending_location_change(p_match_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select exists (
      select 1
      from public.match_location_change_requests r
      where r.match_id = p_match_id
        and r.status = 'pending'
    );
  $$;

  create or replace function public.current_user_can_view_match_location_change(p_match_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select public.current_user_manages_match(p_match_id)
      or exists (
        select 1
        from public.matches m
        where m.id = p_match_id
          and (
            public.current_user_is_captain_of_team(m.home_team_id)
            or public.current_user_is_captain_of_team(m.away_team_id)
          )
      );
  $$;

  -- ---------------------------------------------------------------------------
  -- Propose / respond / state
  -- ---------------------------------------------------------------------------

  create or replace function public.propose_match_location_change(
    p_match_id uuid,
    p_proposed_location text,
    p_proposing_team_id uuid
  )
  returns uuid
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_match public.matches%rowtype;
    v_request_id uuid;
    v_location text;
  begin
    if auth.uid() is null then
      raise exception 'Authentication required';
    end if;

    v_location := nullif(trim(p_proposed_location), '');
    if v_location is null then
      raise exception 'Proposed location is required';
    end if;

    select * into v_match
    from public.matches m
    where m.id = p_match_id
    for update;

    if not found then
      raise exception 'Match not found';
    end if;

    if v_match.played_at is not null then
      raise exception 'Cannot change location for a played match';
    end if;

    if public.match_has_pending_postponement(p_match_id) then
      raise exception 'A postponement request is already pending for this match';
    end if;

    if exists (
      select 1
      from public.match_location_change_requests r
      where r.match_id = p_match_id
        and r.status = 'pending'
    ) then
      raise exception 'A location change request is already pending for this match';
    end if;

    if p_proposing_team_id not in (v_match.home_team_id, v_match.away_team_id) then
      raise exception 'Proposing team must be home or away for this match';
    end if;

    if not (
      public.current_user_is_captain_of_team(p_proposing_team_id)
      or public.current_user_manages_match(p_match_id)
    ) then
      raise exception 'Only the team captain or a competition manager may propose a location change';
    end if;

    insert into public.match_location_change_requests (
      match_id,
      status,
      proposed_location,
      proposing_team_id,
      proposed_by
    )
    values (
      p_match_id,
      'pending',
      v_location,
      p_proposing_team_id,
      auth.uid()
    )
    returning id into v_request_id;

    insert into public.match_logs (match_id, action, user_id)
    values (p_match_id, 'location_change_proposed', auth.uid());

    return v_request_id;
  end;
  $$;

  create or replace function public.respond_match_location_change(
    p_request_id uuid,
    p_action text
  )
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_request public.match_location_change_requests%rowtype;
    v_match public.matches%rowtype;
    v_other_team_id uuid;
    v_log_action text;
  begin
    if auth.uid() is null then
      raise exception 'Authentication required';
    end if;

    if p_action not in ('approve', 'reject', 'cancel') then
      raise exception 'Invalid action: %', p_action;
    end if;

    select * into v_request
    from public.match_location_change_requests r
    where r.id = p_request_id
    for update;

    if not found then
      raise exception 'Location change request not found';
    end if;

    if v_request.status <> 'pending' then
      raise exception 'Location change request is no longer pending';
    end if;

    select * into v_match
    from public.matches m
    where m.id = v_request.match_id
    for update;

    if v_match.played_at is not null then
      raise exception 'Cannot respond to location change for a played match';
    end if;

    if v_request.proposing_team_id = v_match.home_team_id then
      v_other_team_id := v_match.away_team_id;
    else
      v_other_team_id := v_match.home_team_id;
    end if;

    if p_action = 'cancel' then
      if not public.current_user_is_captain_of_team(v_request.proposing_team_id) then
        raise exception 'Only the proposing captain may cancel this request';
      end if;

      update public.match_location_change_requests
      set
        status = 'cancelled',
        responded_by = auth.uid(),
        responded_at = now()
      where id = p_request_id;

      v_log_action := 'location_change_cancelled';
    elsif p_action in ('approve', 'reject') then
      if not (
        public.current_user_is_captain_of_team(v_other_team_id)
        or public.current_user_manages_match(v_match.id)
      ) then
        raise exception 'Only the opposing team captain or a competition manager may approve or reject';
      end if;

      if p_action = 'approve' then
        update public.matches
        set location_override = v_request.proposed_location
        where id = v_match.id;

        update public.match_location_change_requests
        set
          status = 'approved',
          responded_by = auth.uid(),
          responded_at = now()
        where id = p_request_id;

        v_log_action := 'location_change_approved';
      else
        update public.match_location_change_requests
        set
          status = 'rejected',
          responded_by = auth.uid(),
          responded_at = now()
        where id = p_request_id;

        v_log_action := 'location_change_rejected';
      end if;
    end if;

    insert into public.match_logs (match_id, action, user_id)
    values (v_match.id, v_log_action, auth.uid());
  end;
  $$;

  create or replace function public.get_match_location_change_state(p_match_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
  as $$
  declare
    v_match public.matches%rowtype;
    v_pending public.match_location_change_requests%rowtype;
    v_home_captain boolean;
    v_away_captain boolean;
    v_other_team_id uuid;
    v_can_propose boolean := false;
    v_can_approve boolean := false;
    v_can_reject boolean := false;
    v_can_cancel boolean := false;
    v_captain_teams uuid[] := array[]::uuid[];
  begin
    select * into v_match
    from public.matches m
    where m.id = p_match_id;

    if not found then
      return null;
    end if;

    v_home_captain := public.current_user_is_captain_of_team(v_match.home_team_id);
    v_away_captain := public.current_user_is_captain_of_team(v_match.away_team_id);

    if v_home_captain then
      v_captain_teams := array_append(v_captain_teams, v_match.home_team_id);
    end if;
    if v_away_captain then
      v_captain_teams := array_append(v_captain_teams, v_match.away_team_id);
    end if;

    select * into v_pending
    from public.match_location_change_requests r
    where r.match_id = p_match_id
      and r.status = 'pending'
    limit 1;

    if v_match.played_at is null
      and v_pending.id is null
      and not public.match_has_pending_postponement(p_match_id)
    then
      if v_home_captain or v_away_captain then
        v_can_propose := true;
      elsif public.current_user_manages_match(p_match_id) then
        v_can_propose := true;
        v_captain_teams := array[v_match.home_team_id, v_match.away_team_id];
      end if;
    end if;

    if v_pending.id is not null then
      if v_pending.proposing_team_id = v_match.home_team_id then
        v_other_team_id := v_match.away_team_id;
      else
        v_other_team_id := v_match.home_team_id;
      end if;

      if public.current_user_is_captain_of_team(v_other_team_id) then
        v_can_approve := true;
        v_can_reject := true;
      end if;

      if public.current_user_manages_match(p_match_id) then
        v_can_approve := true;
        v_can_reject := true;
      end if;

      if public.current_user_is_captain_of_team(v_pending.proposing_team_id) then
        v_can_cancel := true;
      end if;
    end if;

    return jsonb_build_object(
      'match_id', v_match.id,
      'datetime', v_match.datetime,
      'played_at', v_match.played_at,
      'home_team_id', v_match.home_team_id,
      'away_team_id', v_match.away_team_id,
      'location_override', v_match.location_override,
      'captain_teams', to_jsonb(v_captain_teams),
      'can_propose', v_can_propose,
      'can_approve', v_can_approve,
      'can_reject', v_can_reject,
      'can_cancel', v_can_cancel,
      'pending', case
        when v_pending.id is null then null
        else jsonb_build_object(
          'id', v_pending.id,
          'proposed_location', v_pending.proposed_location,
          'proposing_team_id', v_pending.proposing_team_id,
          'proposed_by', v_pending.proposed_by,
          'created_at', v_pending.created_at
        )
      end
    );
  end;
  $$;

  -- ---------------------------------------------------------------------------
  -- Mutual exclusion: postponement <-> location change
  -- ---------------------------------------------------------------------------

  create or replace function public.propose_match_postponement(
    p_match_id uuid,
    p_proposed_datetime timestamptz,
    p_proposing_team_id uuid
  )
  returns uuid
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_match public.matches%rowtype;
    v_request_id uuid;
  begin
    if auth.uid() is null then
      raise exception 'Authentication required';
    end if;

    select * into v_match
    from public.matches m
    where m.id = p_match_id
    for update;

    if not found then
      raise exception 'Match not found';
    end if;

    if v_match.played_at is not null then
      raise exception 'Cannot postpone a match that has been played';
    end if;

    if public.match_has_pending_location_change(p_match_id) then
      raise exception 'A location change request is already pending for this match';
    end if;

    if exists (
      select 1
      from public.match_postponement_requests r
      where r.match_id = p_match_id
        and r.status = 'pending'
    ) then
      raise exception 'A postponement request is already pending for this match';
    end if;

    if p_proposing_team_id not in (v_match.home_team_id, v_match.away_team_id) then
      raise exception 'Proposing team must be home or away for this match';
    end if;

    if not (
      public.current_user_is_captain_of_team(p_proposing_team_id)
      or public.current_user_manages_match(p_match_id)
    ) then
      raise exception 'Only the team captain or a competition manager may propose a postponement';
    end if;

    insert into public.match_postponement_requests (
      match_id,
      status,
      proposed_datetime,
      proposing_team_id,
      proposed_by
    )
    values (
      p_match_id,
      'pending',
      p_proposed_datetime,
      p_proposing_team_id,
      auth.uid()
    )
    returning id into v_request_id;

    insert into public.match_logs (match_id, action, user_id)
    values (p_match_id, 'postponement_proposed', auth.uid());

    return v_request_id;
  end;
  $$;

  create or replace function public.get_match_postponement_state(p_match_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
  as $$
  declare
    v_match public.matches%rowtype;
    v_pending public.match_postponement_requests%rowtype;
    v_home_captain boolean;
    v_away_captain boolean;
    v_other_team_id uuid;
    v_can_propose boolean := false;
    v_can_approve boolean := false;
    v_can_reject boolean := false;
    v_can_cancel boolean := false;
    v_captain_teams uuid[] := array[]::uuid[];
  begin
    select * into v_match
    from public.matches m
    where m.id = p_match_id;

    if not found then
      return null;
    end if;

    v_home_captain := public.current_user_is_captain_of_team(v_match.home_team_id);
    v_away_captain := public.current_user_is_captain_of_team(v_match.away_team_id);

    if v_home_captain then
      v_captain_teams := array_append(v_captain_teams, v_match.home_team_id);
    end if;
    if v_away_captain then
      v_captain_teams := array_append(v_captain_teams, v_match.away_team_id);
    end if;

    select * into v_pending
    from public.match_postponement_requests r
    where r.match_id = p_match_id
      and r.status = 'pending'
    limit 1;

    if v_match.played_at is null
      and v_pending.id is null
      and not public.match_has_pending_location_change(p_match_id)
    then
      if v_home_captain or v_away_captain then
        v_can_propose := true;
      elsif public.current_user_manages_match(p_match_id) then
        v_can_propose := true;
        v_captain_teams := array[v_match.home_team_id, v_match.away_team_id];
      end if;
    end if;

    if v_pending.id is not null then
      if v_pending.proposing_team_id = v_match.home_team_id then
        v_other_team_id := v_match.away_team_id;
      else
        v_other_team_id := v_match.home_team_id;
      end if;

      if public.current_user_is_captain_of_team(v_other_team_id) then
        v_can_approve := true;
        v_can_reject := true;
      end if;

      if public.current_user_manages_match(p_match_id) then
        v_can_approve := true;
        v_can_reject := true;
      end if;

      if public.current_user_is_captain_of_team(v_pending.proposing_team_id) then
        v_can_cancel := true;
      end if;
    end if;

    return jsonb_build_object(
      'match_id', v_match.id,
      'datetime', v_match.datetime,
      'played_at', v_match.played_at,
      'home_team_id', v_match.home_team_id,
      'away_team_id', v_match.away_team_id,
      'captain_teams', to_jsonb(v_captain_teams),
      'can_propose', v_can_propose,
      'can_approve', v_can_approve,
      'can_reject', v_can_reject,
      'can_cancel', v_can_cancel,
      'pending', case
        when v_pending.id is null then null
        else jsonb_build_object(
          'id', v_pending.id,
          'proposed_datetime', v_pending.proposed_datetime,
          'proposing_team_id', v_pending.proposing_team_id,
          'proposed_by', v_pending.proposed_by,
          'created_at', v_pending.created_at
        )
      end
    );
  end;
  $$;

  -- ---------------------------------------------------------------------------
  -- Migrate home/away switch data → location changes
  -- ---------------------------------------------------------------------------

  -- Copy requests first (while hosting_team_id still reflects approved switches).
  -- Proposed location = venue of the team that would host after a toggle.
  insert into public.match_location_change_requests (
    id,
    match_id,
    status,
    proposed_location,
    proposing_team_id,
    proposed_by,
    responded_by,
    created_at,
    responded_at
  )
  select
    r.id,
    r.match_id,
    r.status,
    coalesce(
      public.resolve_team_match_location(
        case
          when coalesce(m.hosting_team_id, m.home_team_id) = m.home_team_id
            then m.away_team_id
          else m.home_team_id
        end
      ),
      public.resolve_team_match_location(m.hosting_team_id),
      public.resolve_team_match_location(m.home_team_id),
      'Location changed'
    ),
    r.requesting_team_id,
    r.proposed_by,
    r.responded_by,
    r.created_at,
    r.responded_at
  from public.match_home_away_switch_requests r
  join public.matches m on m.id = r.match_id
  on conflict (id) do nothing;

  -- Approved switches: hosting already toggled → store hosting venue as override, reset host.
  update public.matches m
  set
    location_override = coalesce(
      nullif(trim(m.location_override), ''),
      public.resolve_team_match_location(m.hosting_team_id),
      'Location changed'
    ),
    hosting_team_id = m.home_team_id
  where m.hosting_team_id is distinct from m.home_team_id
    and m.hosting_team_id is not null;

  -- For approved migrated requests, align proposed_location with the applied override.
  update public.match_location_change_requests r
  set proposed_location = m.location_override
  from public.matches m
  where r.match_id = m.id
    and r.status = 'approved'
    and m.location_override is not null;

  -- Remap audit log actions for migrated requests.
  update public.match_logs
  set action = case action
    when 'home_away_switch_proposed' then 'location_change_proposed'
    when 'home_away_switch_approved' then 'location_change_approved'
    when 'home_away_switch_rejected' then 'location_change_rejected'
    when 'home_away_switch_cancelled' then 'location_change_cancelled'
    else action
  end
  where action in (
    'home_away_switch_proposed',
    'home_away_switch_approved',
    'home_away_switch_rejected',
    'home_away_switch_cancelled'
  );

  -- ---------------------------------------------------------------------------
  -- Drop home/away switch surface
  -- ---------------------------------------------------------------------------

  drop policy if exists match_home_away_switch_requests_manager_read
    on public.match_home_away_switch_requests;
  drop policy if exists match_home_away_switch_requests_read
    on public.match_home_away_switch_requests;

  drop function if exists public.propose_match_home_away_switch(uuid, uuid);
  drop function if exists public.respond_match_home_away_switch(uuid, text);
  drop function if exists public.get_match_home_away_switch_state(uuid);
  drop function if exists public.match_has_pending_home_away_switch(uuid);
  drop function if exists public.current_user_can_view_match_home_away_switch(uuid);
  drop function if exists public.match_mirror_switch_context(uuid);

  drop table if exists public.match_home_away_switch_requests;

  -- ---------------------------------------------------------------------------
  -- RLS + grants
  -- ---------------------------------------------------------------------------

  alter table public.match_location_change_requests enable row level security;

  create policy match_location_change_requests_read on public.match_location_change_requests
    for select to authenticated
    using (public.current_user_can_view_match_location_change(match_id));

  create policy match_location_change_requests_manager_read on public.match_location_change_requests
    for select to authenticated
    using (public.current_user_manages_match(match_id));

  grant execute on function public.resolve_team_match_location(uuid) to authenticated;
  grant execute on function public.match_has_pending_location_change(uuid) to authenticated;
  grant execute on function public.current_user_can_view_match_location_change(uuid) to authenticated;
  grant execute on function public.propose_match_location_change(uuid, text, uuid) to authenticated;
  grant execute on function public.respond_match_location_change(uuid, text) to authenticated;
  grant execute on function public.get_match_location_change_state(uuid) to authenticated;
