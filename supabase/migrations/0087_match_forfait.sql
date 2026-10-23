-- Match forfait: one side forfeits; winner gets max(12, average non-forfait VP).

alter table public.matches
  add column if not exists forfait_side text;

alter table public.matches
  drop constraint if exists matches_forfait_side_check;
alter table public.matches
  add constraint matches_forfait_side_check
  check (forfait_side is null or forfait_side in ('home', 'away'));

comment on column public.matches.forfait_side is
  'When set, that side forfeited; winner VP is max(12, average of other non-forfait match VPs); forfeiter gets 0.';

create index if not exists matches_group_forfait_idx
  on public.matches (group_id)
  where forfait_side is not null;
