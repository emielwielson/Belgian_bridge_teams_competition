-- Scoped arbiter access: competition kinds (inbox) + separate Honor Division access.
-- Empty arbiter competition scopes = no inbox (unlike competition managers).
-- Existing arbiters are backfilled to all kinds + honor.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.arbiter_competition_scopes (
  user_id uuid not null references auth.users (id) on delete cascade,
  competition_kind_id uuid not null references public.competition_kinds (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, competition_kind_id)
);

create index arbiter_competition_scopes_user_id_idx
  on public.arbiter_competition_scopes (user_id);

create table public.arbiter_honor_access (
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id)
);

alter table public.arbiter_competition_scopes enable row level security;
alter table public.arbiter_honor_access enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_user_is_arbiter_for_kind(p_kind_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_has_role('arbiter')
    and exists (
      select 1
      from public.arbiter_competition_scopes acs
      where acs.user_id = auth.uid()
        and acs.competition_kind_id = p_kind_id
    );
$$;

create or replace function public.current_user_has_arbiter_honor_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_has_role('arbiter')
    and exists (
      select 1
      from public.arbiter_honor_access aha
      where aha.user_id = auth.uid()
    );
$$;

create or replace function public.current_user_has_any_arbiter_inbox_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_has_role('arbiter')
    and exists (
      select 1
      from public.arbiter_competition_scopes acs
      where acs.user_id = auth.uid()
    );
$$;

create or replace function public.current_user_is_arbiter_for_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_has_role('arbiter')
    and exists (
      select 1
      from public.matches m
      join public.groups g on g.id = m.group_id
      join public.divisions d on d.id = g.division_id
      join public.leagues l on l.id = d.league_id
      join public.arbiter_competition_scopes acs
        on acs.user_id = auth.uid()
       and acs.competition_kind_id = l.competition_kind_id
      where m.id = p_match_id
    );
$$;

create or replace function public.current_user_is_arbiter_for_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_has_role('arbiter')
    and exists (
      select 1
      from public.teams t
      join public.groups g on g.id = t.group_id
      join public.divisions d on d.id = g.division_id
      join public.leagues l on l.id = d.league_id
      join public.arbiter_competition_scopes acs
        on acs.user_id = auth.uid()
       and acs.competition_kind_id = l.competition_kind_id
      where t.id = p_team_id
    );
$$;

create or replace function public.current_user_can_manage_arbiter_kind(p_kind_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_manages_competition_kind(p_kind_id);
$$;

create or replace function public.current_user_can_manage_arbiter_honor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_is_system_admin()
    or exists (
      select 1
      from public.competition_kinds ck
      where ck.code = 'national'
        and public.current_user_manages_competition_kind(ck.id)
    );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

create policy arbiter_competition_scopes_select on public.arbiter_competition_scopes
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.current_user_is_system_admin()
    or public.current_user_is_competition_manager()
  );

create policy arbiter_competition_scopes_insert on public.arbiter_competition_scopes
  for insert to authenticated
  with check (
    public.current_user_is_system_admin()
    or public.current_user_can_manage_arbiter_kind(competition_kind_id)
  );

create policy arbiter_competition_scopes_delete on public.arbiter_competition_scopes
  for delete to authenticated
  using (
    public.current_user_is_system_admin()
    or public.current_user_can_manage_arbiter_kind(competition_kind_id)
  );

create policy arbiter_honor_access_select on public.arbiter_honor_access
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.current_user_is_system_admin()
    or public.current_user_is_competition_manager()
  );

create policy arbiter_honor_access_insert on public.arbiter_honor_access
  for insert to authenticated
  with check (
    public.current_user_is_system_admin()
    or public.current_user_can_manage_arbiter_honor()
  );

create policy arbiter_honor_access_delete on public.arbiter_honor_access
  for delete to authenticated
  using (
    public.current_user_is_system_admin()
    or public.current_user_can_manage_arbiter_honor()
  );

-- ---------------------------------------------------------------------------
-- Backfill existing arbiters → all kinds + honor
-- ---------------------------------------------------------------------------

insert into public.arbiter_competition_scopes (user_id, competition_kind_id)
select ur.user_id, ck.id
from public.user_roles ur
cross join public.competition_kinds ck
where ur.role = 'arbiter'
on conflict do nothing;

insert into public.arbiter_honor_access (user_id)
select ur.user_id
from public.user_roles ur
where ur.role = 'arbiter'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Tighten match / ops helpers that previously treated any arbiter as global
-- ---------------------------------------------------------------------------

create or replace function public.current_user_can_view_match_arbiter_requests(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_manages_match(p_match_id)
    or public.current_user_is_arbiter_for_match(p_match_id)
    or public.current_user_can_submit_score(p_match_id);
$$;

create or replace function public.current_user_can_admin_edit_score(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_manages_match(p_match_id)
    or public.current_user_is_arbiter_for_match(p_match_id);
$$;

create or replace function public.current_user_can_view_match_ops(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_submit_score(p_match_id)
    or public.current_user_is_arbiter_for_match(p_match_id)
    or public.current_user_manages_match(p_match_id);
$$;

create or replace function public.enforce_match_score_edit_policy()
returns trigger
language plpgsql
as $$
begin
  if old.played_at is not null
    and (
      new.imps_home is distinct from old.imps_home
      or new.imps_away is distinct from old.imps_away
      or new.vp_home is distinct from old.vp_home
      or new.vp_away is distinct from old.vp_away
    )
    and not (
      coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or public.current_user_manages_match(coalesce(new.id, old.id))
      or public.current_user_is_arbiter_for_match(coalesce(new.id, old.id))
    )
  then
    raise exception 'Score edits after match is played require arbiter or competition manager';
  end if;

  if (
    new.imps_home is distinct from old.imps_home
    or new.imps_away is distinct from old.imps_away
    or new.vp_home is distinct from old.vp_home
    or new.vp_away is distinct from old.vp_away
  ) then
    new.last_modified_by := auth.uid();
    new.last_modified_at := now();
  end if;

  return new;
end;
$$;

-- Discipline policies: scoped arbiters
drop policy if exists penalties_discipline_write on public.penalties;
create policy penalties_discipline_write on public.penalties
  for all to authenticated
  using (
    public.current_user_is_arbiter_for_team(team_id)
    or public.current_user_manages_team(team_id)
  )
  with check (
    public.current_user_is_arbiter_for_team(team_id)
    or public.current_user_manages_team(team_id)
  );

drop policy if exists warnings_discipline_write on public.warnings;
create policy warnings_discipline_write on public.warnings
  for all to authenticated
  using (
    public.current_user_is_arbiter_for_team(team_id)
    or public.current_user_manages_team(team_id)
  )
  with check (
    public.current_user_is_arbiter_for_team(team_id)
    or public.current_user_manages_team(team_id)
  );

drop policy if exists rulings_discipline_write on public.rulings;
create policy rulings_discipline_write on public.rulings
  for all to authenticated
  using (
    public.current_user_is_arbiter_for_match(match_id)
    or public.current_user_manages_match(match_id)
  )
  with check (
    public.current_user_is_arbiter_for_match(match_id)
    or public.current_user_manages_match(match_id)
  );

drop policy if exists arbiter_requests_arbiter_update on public.arbiter_requests;
create policy arbiter_requests_arbiter_update on public.arbiter_requests
  for update to authenticated
  using (
    public.current_user_is_arbiter_for_match(match_id)
    or public.current_user_manages_match(match_id)
  )
  with check (
    public.current_user_is_arbiter_for_match(match_id)
    or public.current_user_manages_match(match_id)
  );

-- Honor draft visibility: honor-access arbiters (managers unchanged)
drop policy if exists honor_boards_public_read on public.honor_boards;
create policy honor_boards_public_read on public.honor_boards
  for select to anon, authenticated
  using (
    publication_status = 'published'
    or public.current_user_is_competition_manager()
    or public.current_user_has_arbiter_honor_access()
  );

drop policy if exists honor_board_results_public_read on public.honor_board_results;
create policy honor_board_results_public_read on public.honor_board_results
  for select to anon, authenticated
  using (
    processing_status = 'published'
    or public.current_user_is_competition_manager()
    or public.current_user_has_arbiter_honor_access()
  );

drop policy if exists honor_raw_imports_staff_read on public.honor_raw_imports;
create policy honor_raw_imports_staff_read on public.honor_raw_imports
  for select to authenticated
  using (
    public.current_user_is_competition_manager()
    or public.current_user_has_arbiter_honor_access()
  );

-- ---------------------------------------------------------------------------
-- Resolve RPC: require kind-scoped arbiter (or manage match)
-- ---------------------------------------------------------------------------

create or replace function public.arbiter_request_resolve(
  p_request_id uuid,
  p_ruling_file_path text,
  p_actions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.arbiter_requests%rowtype;
  v_match public.matches%rowtype;
  v_file_path text;
  v_ruling_id uuid;
  v_actions jsonb := coalesce(p_actions, '{}'::jsonb);
  v_score jsonb;
  v_imps_home numeric;
  v_imps_away numeric;
  v_mis_seating boolean;
  v_selected_board_count int;
  v_vp_board_count int;
  v_vp_home numeric;
  v_vp_away numeric;
  v_penalty jsonb;
  v_warning jsonb;
  v_team_id uuid;
  v_vp_deduction numeric;
  v_reason text;
  v_date date;
  v_penalty_ids uuid[] := '{}';
  v_warning_ids uuid[] := '{}';
  v_penalty_id uuid;
  v_warning_id uuid;
  v_score_result jsonb := null;
  v_log_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.current_user_has_role('arbiter')
    and not public.current_user_has_role('competition_manager')
    and not public.current_user_is_system_admin() then
    raise exception 'Only an arbiter or competition manager may resolve requests';
  end if;

  v_file_path := nullif(trim(p_ruling_file_path), '');
  if v_file_path is null then
    raise exception 'Ruling document is required';
  end if;

  select * into v_request
  from public.arbiter_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'Arbiter request not found';
  end if;

  if v_request.status <> 'open' then
    raise exception 'Arbiter request is already resolved';
  end if;

  select * into v_match
  from public.matches m
  where m.id = v_request.match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if not public.current_user_is_arbiter_for_match(v_match.id)
    and not public.current_user_manages_match(v_match.id) then
    raise exception 'Only an arbiter or competition manager may resolve requests';
  end if;

  insert into public.rulings (
    match_id,
    file_path,
    arbiter_request_id,
    created_by
  )
  values (
    v_request.match_id,
    v_file_path,
    p_request_id,
    auth.uid()
  )
  returning id into v_ruling_id;

  update public.arbiter_requests
  set
    status = 'resolved',
    resolved_by = auth.uid(),
    resolved_at = now(),
    updated_at = now()
  where id = p_request_id;

  insert into public.match_logs (match_id, action, user_id)
  values (v_request.match_id, 'ruling_created', auth.uid());

  -- Optional score change
  if v_actions ? 'score_change' and v_actions->'score_change' is not null
    and v_actions->'score_change' <> 'null'::jsonb then
    v_score := v_actions->'score_change';

    if v_match.played_at is null then
      raise exception 'Score change requires the match to have an official score';
    end if;

    v_imps_home := (v_score->>'imps_home')::numeric;
    v_imps_away := (v_score->>'imps_away')::numeric;
    if v_imps_home is null or v_imps_away is null then
      raise exception 'Score change requires imps_home and imps_away';
    end if;

    v_mis_seating := coalesce((v_score->>'mis_seating')::boolean, false);
    v_selected_board_count := nullif(v_score->>'selected_board_count', '')::int;
    v_vp_board_count := nullif(v_score->>'vp_board_count', '')::int;

    if v_vp_board_count is null or v_vp_board_count <= 0 then
      raise exception 'Score change requires a positive vp_board_count';
    end if;

    update public.matches
    set
      mis_seating = v_mis_seating,
      selected_board_count = v_selected_board_count,
      vp_board_count = v_vp_board_count
    where id = v_match.id;

    select l.vp_home, l.vp_away
    into v_vp_home, v_vp_away
    from public.lookup_vp_for_match(v_match.id, v_imps_home, v_imps_away) l;

    update public.matches
    set
      imps_home = v_imps_home,
      imps_away = v_imps_away,
      vp_home = v_vp_home,
      vp_away = v_vp_away,
      last_modified_by = auth.uid(),
      last_modified_at = now()
    where id = v_match.id;

    v_log_payload := jsonb_build_object(
      'imps_home', v_imps_home,
      'imps_away', v_imps_away,
      'vp_home', v_vp_home,
      'vp_away', v_vp_away,
      'vp_board_count', v_vp_board_count,
      'mis_seating', v_mis_seating,
      'selected_board_count', v_selected_board_count,
      'previous', jsonb_build_object(
        'imps_home', v_match.imps_home,
        'imps_away', v_match.imps_away,
        'vp_home', v_match.vp_home,
        'vp_away', v_match.vp_away
      )
    );

    insert into public.match_logs (match_id, action, user_id)
    values (
      v_request.match_id,
      'score_arbiter_edit:' || v_log_payload::text,
      auth.uid()
    );

    v_score_result := jsonb_build_object(
      'imps_home', v_imps_home,
      'imps_away', v_imps_away,
      'vp_home', v_vp_home,
      'vp_away', v_vp_away,
      'vp_board_count', v_vp_board_count,
      'mis_seating', v_mis_seating,
      'selected_board_count', v_selected_board_count
    );
  end if;

  -- Optional penalties
  if jsonb_typeof(v_actions->'penalties') = 'array' then
    for v_penalty in
      select value from jsonb_array_elements(v_actions->'penalties') as t(value)
    loop
      v_team_id := nullif(v_penalty->>'team_id', '')::uuid;
      v_reason := nullif(trim(v_penalty->>'reason'), '');
      v_vp_deduction := coalesce((v_penalty->>'vp_deduction')::numeric, 0);
      v_date := nullif(v_penalty->>'penalty_date', '')::date;

      if v_team_id is null or v_reason is null or v_date is null then
        raise exception 'Each penalty requires team_id, penalty_date, and reason';
      end if;

      if v_team_id not in (v_match.home_team_id, v_match.away_team_id) then
        raise exception 'Penalty team must be the home or away team of the match';
      end if;

      if v_vp_deduction < 0 then
        raise exception 'Penalty vp_deduction must be non-negative';
      end if;

      insert into public.penalties (
        team_id,
        penalty_date,
        reason,
        vp_deduction,
        arbiter_request_id,
        created_by
      )
      values (
        v_team_id,
        v_date,
        v_reason,
        v_vp_deduction,
        p_request_id,
        auth.uid()
      )
      returning id into v_penalty_id;

      v_penalty_ids := array_append(v_penalty_ids, v_penalty_id);

      insert into public.match_logs (match_id, action, user_id)
      values (
        v_request.match_id,
        'penalty_created:' || jsonb_build_object(
          'penalty_id', v_penalty_id,
          'team_id', v_team_id,
          'vp_deduction', v_vp_deduction
        )::text,
        auth.uid()
      );
    end loop;
  end if;

  -- Optional warnings
  if jsonb_typeof(v_actions->'warnings') = 'array' then
    for v_warning in
      select value from jsonb_array_elements(v_actions->'warnings') as t(value)
    loop
      v_team_id := nullif(v_warning->>'team_id', '')::uuid;
      v_reason := nullif(trim(v_warning->>'reason'), '');
      v_date := nullif(v_warning->>'warning_date', '')::date;

      if v_team_id is null or v_reason is null or v_date is null then
        raise exception 'Each warning requires team_id, warning_date, and reason';
      end if;

      if v_team_id not in (v_match.home_team_id, v_match.away_team_id) then
        raise exception 'Warning team must be the home or away team of the match';
      end if;

      insert into public.warnings (
        team_id,
        warning_date,
        reason,
        arbiter_request_id,
        created_by
      )
      values (
        v_team_id,
        v_date,
        v_reason,
        p_request_id,
        auth.uid()
      )
      returning id into v_warning_id;

      v_warning_ids := array_append(v_warning_ids, v_warning_id);

      insert into public.match_logs (match_id, action, user_id)
      values (
        v_request.match_id,
        'warning_created:' || jsonb_build_object(
          'warning_id', v_warning_id,
          'team_id', v_team_id
        )::text,
        auth.uid()
      );
    end loop;
  end if;

  insert into public.match_logs (match_id, action, user_id)
  values (v_request.match_id, 'arbiter_request_resolved', auth.uid());

  return jsonb_build_object(
    'ruling_id', v_ruling_id,
    'score', v_score_result,
    'penalty_ids', to_jsonb(v_penalty_ids),
    'warning_ids', to_jsonb(v_warning_ids)
  );
end;
$$;


grant execute on function public.current_user_is_arbiter_for_kind(uuid) to anon, authenticated;
grant execute on function public.current_user_has_arbiter_honor_access() to anon, authenticated;
grant execute on function public.current_user_has_any_arbiter_inbox_access() to anon, authenticated;
grant execute on function public.current_user_is_arbiter_for_match(uuid) to anon, authenticated;
grant execute on function public.current_user_is_arbiter_for_team(uuid) to anon, authenticated;
grant execute on function public.current_user_can_manage_arbiter_kind(uuid) to anon, authenticated;
grant execute on function public.current_user_can_manage_arbiter_honor() to anon, authenticated;

grant select, insert, delete on public.arbiter_competition_scopes to authenticated;
grant select, insert, delete on public.arbiter_honor_access to authenticated;
