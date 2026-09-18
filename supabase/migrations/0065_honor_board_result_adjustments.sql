-- Honor board result arbiter adjustments: split IMPs, match-score inclusion, audit meta.

alter table public.honor_board_results
  add column if not exists admin_ew_butler_imps numeric;

alter table public.honor_board_results
  add column if not exists included_in_match_score boolean not null default true;

alter table public.honor_board_results
  add column if not exists adjustment_mode text
    check (
      adjustment_mode is null
      or adjustment_mode in (
        'cancelled',
        'artificial',
        'split',
        'weighted',
        'correction'
      )
    );

alter table public.honor_board_results
  add column if not exists adjustment_meta jsonb;

comment on column public.honor_board_results.admin_ew_butler_imps is
  'Independent EW Butler IMP award (split scores); when null, EW = -NS admin IMP.';
comment on column public.honor_board_results.included_in_match_score is
  'When false, this room result is excluded from team match IMP totals (e.g. cancelled).';
comment on column public.honor_board_results.adjustment_mode is
  'Arbiter adjustment provenance: cancelled | artificial | split | weighted | correction.';
comment on column public.honor_board_results.adjustment_meta is
  'Calculator inputs / audit payload for the last adjustment.';
