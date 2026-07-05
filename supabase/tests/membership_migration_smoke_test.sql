-- Membership migration smoke test (shared DB, migrations 0020–0025 on Ledenbeheer)
-- Run in Supabase SQL Editor after membership migrations are applied.
-- Competition migrations 0001–0019 must remain unchanged.
--
-- Section 1: data integrity. Compare row counts to pre-migration baseline manually.

-- Row counts (record these and compare to pre-migration snapshot)
select 'players' as table_name, count(*) as row_count from public.players
union all
select 'player_club_memberships', count(*) from public.player_club_memberships
union all
select 'clubs', count(*) from public.clubs;

-- Broken core fields (expect 0 for both)
select count(*) as players_with_empty_name
from public.players
where name is null or btrim(name) = '';

select count(*) as players_with_blank_email
from public.players
where email is not null and btrim(email) = '';

-- Primary membership backfill: expect 0 rows
select player_id, count(*) as active_primary_count
from public.player_club_memberships
where membership_type = 'primary' and status = 'active'
group by player_id
having count(*) > 1;

-- Competition constraint still in place: one club per player per season
select player_id, season_id, count(*) as membership_count
from public.player_club_memberships
group by player_id, season_id
having count(*) > 1;

-- Columns the competition app selects must still exist
do $$
declare
  v_missing text[];
begin
  select array_agg(col)
  into v_missing
  from unnest(array[
    'players.id', 'players.name', 'players.member_number', 'players.email', 'players.created_at',
    'player_club_memberships.player_id', 'player_club_memberships.club_id',
    'player_club_memberships.season_id', 'player_club_memberships.created_at',
    'clubs.id', 'clubs.name', 'clubs.region_id', 'clubs.location'
  ]) as col
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = split_part(col, '.', 1)
      and c.column_name = split_part(col, '.', 2)
  );

  if v_missing is not null and array_length(v_missing, 1) > 0 then
    raise exception 'Missing columns required by competition app: %', v_missing;
  end if;
end $$;

select 'membership_migration_smoke_test passed' as result;
