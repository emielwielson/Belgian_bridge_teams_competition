-- Players may change clubs during an active season; remove membership lock.

drop trigger if exists player_club_memberships_block_active on public.player_club_memberships;
drop function if exists public.block_membership_when_active();
