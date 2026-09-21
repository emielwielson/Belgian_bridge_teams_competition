-- Allow average +/− (A+/A−, G+/G−) arbiter adjustment mode.

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
      'average_pm',
      'correction'
    )
  );

comment on column public.honor_board_results.adjustment_mode is
  'Arbiter adjustment: cancelled|artificial(legacy)|split|weighted|average_pm|correction';
