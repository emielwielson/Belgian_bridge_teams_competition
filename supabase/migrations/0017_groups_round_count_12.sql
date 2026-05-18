-- Flanders Liga 3 (4-team groups) plays 12 rounds; allow 12 alongside 14 and 21.

alter table public.groups
  drop constraint if exists groups_round_count_check;

alter table public.groups
  add constraint groups_round_count_check check (round_count in (12, 14, 21));
