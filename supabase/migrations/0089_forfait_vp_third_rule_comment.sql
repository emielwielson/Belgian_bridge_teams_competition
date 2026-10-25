-- Document three-way forfait winner VP: max(12, winner avg, 20 − forfeiter avg).
-- Scoring remains application-side (web/lib/scoring/forfait.ts).

comment on column public.matches.forfait_side is
  'When set, that side forfeited; winner VP is max(12, average of winner other played non-forfait VPs, 20 − average of forfeiter other played non-forfait VPs); forfeiter gets 0. Forfait and unplayed matches are excluded from both averages.';
