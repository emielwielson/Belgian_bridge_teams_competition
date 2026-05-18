-- One league per scope per season: National, Flanders, Wallonia (no duplicates / legacy names).

-- Rename legacy national league names
update public.leagues
set name = 'National'
where scope = 'national'
  and name in ('National League', 'National league');

-- Rename legacy regional league names (match region)
update public.leagues l
set name = 'Flanders'
from public.regions r
where l.region_id = r.id
  and l.scope = 'regional'
  and r.code = 'flanders'
  and l.name in (
    'Flanders Regional League',
    'Flanders League',
    'Flanders regional'
  );

update public.leagues l
set name = 'Wallonia'
from public.regions r
where l.region_id = r.id
  and l.scope = 'regional'
  and r.code = 'wallonia'
  and l.name in (
    'Wallonia Regional League',
    'Wallonia League',
    'Wallonia regional'
  );

-- Merge duplicate national leagues per season into one row named National
do $$
declare
  v_season record;
  v_canonical_id uuid;
  v_dup_id uuid;
  v_div record;
begin
  for v_season in
    select season_id
    from public.leagues
    where scope = 'national'
    group by season_id
    having count(*) > 1
  loop
    select l.id into v_canonical_id
    from public.leagues l
    where l.season_id = v_season.season_id
      and l.scope = 'national'
      and l.name = 'National'
    order by l.created_at
    limit 1;

    if v_canonical_id is null then
      select l.id into v_canonical_id
      from public.leagues l
      where l.season_id = v_season.season_id
        and l.scope = 'national'
      order by l.created_at
      limit 1;

      update public.leagues
      set name = 'National'
      where id = v_canonical_id;
    end if;

    for v_dup_id in
      select l.id
      from public.leagues l
      where l.season_id = v_season.season_id
        and l.scope = 'national'
        and l.id <> v_canonical_id
    loop
      for v_div in
        select d.id, d.name
        from public.divisions d
        where d.league_id = v_dup_id
      loop
        if exists (
          select 1
          from public.divisions d2
          where d2.league_id = v_canonical_id
            and d2.name = v_div.name
        ) then
          update public.divisions
          set name = v_div.name || ' (legacy)'
          where id = v_div.id;
        end if;

        update public.divisions
        set league_id = v_canonical_id
        where id = v_div.id;
      end loop;

      delete from public.leagues where id = v_dup_id;
    end loop;
  end loop;
end $$;

-- Merge duplicate regional leagues per season + region
do $$
declare
  v_key record;
  v_canonical_id uuid;
  v_canonical_name text;
  v_dup_id uuid;
  v_div record;
begin
  for v_key in
    select l.season_id, l.region_id
    from public.leagues l
    where l.scope = 'regional'
    group by l.season_id, l.region_id
    having count(*) > 1
  loop
    select r.name into v_canonical_name
    from public.regions r
    where r.id = v_key.region_id;

    select l.id into v_canonical_id
    from public.leagues l
    where l.season_id = v_key.season_id
      and l.region_id = v_key.region_id
      and l.scope = 'regional'
      and l.name = v_canonical_name
    order by l.created_at
    limit 1;

    if v_canonical_id is null then
      select l.id into v_canonical_id
      from public.leagues l
      where l.season_id = v_key.season_id
        and l.region_id = v_key.region_id
        and l.scope = 'regional'
      order by l.created_at
      limit 1;

      update public.leagues
      set name = v_canonical_name
      where id = v_canonical_id;
    end if;

    for v_dup_id in
      select l.id
      from public.leagues l
      where l.season_id = v_key.season_id
        and l.region_id = v_key.region_id
        and l.scope = 'regional'
        and l.id <> v_canonical_id
    loop
      for v_div in
        select d.id, d.name
        from public.divisions d
        where d.league_id = v_dup_id
      loop
        if exists (
          select 1
          from public.divisions d2
          where d2.league_id = v_canonical_id
            and d2.name = v_div.name
        ) then
          update public.divisions
          set name = v_div.name || ' (legacy)'
          where id = v_div.id;
        end if;

        update public.divisions
        set league_id = v_canonical_id
        where id = v_div.id;
      end loop;

      delete from public.leagues where id = v_dup_id;
    end loop;
  end loop;
end $$;

create unique index if not exists leagues_one_national_per_season_idx
  on public.leagues (season_id)
  where scope = 'national';

create unique index if not exists leagues_one_regional_per_region_per_season_idx
  on public.leagues (season_id, region_id)
  where scope = 'regional';
