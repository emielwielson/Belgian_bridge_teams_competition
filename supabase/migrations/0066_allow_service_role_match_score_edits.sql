-- Honor publish / board-correction refresh use the service-role client.
-- Triggers still run; auth.uid() is null there, so the post-played lock
-- incorrectly blocked trusted server-side IMP/VP updates.

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
      or public.current_user_is_arbiter()
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
