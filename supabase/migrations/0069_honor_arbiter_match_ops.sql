-- Honor-access arbiters must count as arbiter on national Honor matches,
-- even without a national competition-kind inbox scope. Otherwise match
-- pages fall back to the league line-up UI (canOps false → no honorPerms).

create or replace function public.current_user_is_arbiter_for_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_has_role('arbiter')
    and (
      exists (
        select 1
        from public.matches m
        join public.groups g on g.id = m.group_id
        join public.divisions d on d.id = g.division_id
        join public.leagues l on l.id = d.league_id
        join public.arbiter_competition_scopes acs
          on acs.user_id = auth.uid()
         and acs.competition_kind_id = l.competition_kind_id
        where m.id = p_match_id
      )
      or (
        public.current_user_has_arbiter_honor_access()
        and exists (
          select 1
          from public.matches m
          join public.groups g on g.id = m.group_id
          join public.divisions d on d.id = g.division_id
          join public.leagues l on l.id = d.league_id
          join public.division_levels dl on dl.id = d.division_level_id
          where m.id = p_match_id
            and l.scope = 'national'
            and dl.code = 'honor'
        )
      )
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
    and (
      exists (
        select 1
        from public.teams t
        join public.groups g on g.id = t.group_id
        join public.divisions d on d.id = g.division_id
        join public.leagues l on l.id = d.league_id
        join public.arbiter_competition_scopes acs
          on acs.user_id = auth.uid()
         and acs.competition_kind_id = l.competition_kind_id
        where t.id = p_team_id
      )
      or (
        public.current_user_has_arbiter_honor_access()
        and exists (
          select 1
          from public.teams t
          join public.groups g on g.id = t.group_id
          join public.divisions d on d.id = g.division_id
          join public.leagues l on l.id = d.league_id
          join public.division_levels dl on dl.id = d.division_level_id
          where t.id = p_team_id
            and l.scope = 'national'
            and dl.code = 'honor'
        )
      )
    );
$$;
