-- Split / weighted datum scores: independent EW-favorable table points.

alter table public.honor_board_results
  add column if not exists admin_adjusted_ew_score integer;

comment on column public.honor_board_results.admin_adjusted_ew_score is
  'Arbiter EW-favorable table points for Butler datum (positive = good for EW). When null, EW score defaults to -NS.';

-- Keep legacy 'artificial' readable; new writes should use cancelled|split|weighted|correction.
alter table public.honor_board_results
  drop constraint if exists honor_board_results_adjustment_mode_check;

alter table public.honor_board_results
  add constraint honor_board_results_adjustment_mode_check
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
