/**
 * Generates SQL for WBF VP table rows. Run: npx tsx scripts/generate-vp-migration-sql.ts
 */
import { getWbfVpBands } from "../lib/scoring/wbf-vp-generator";
import { STANDARD_24_BOARD_VP_BANDS } from "../lib/scoring/standard-vp-bands";

const BOARD_COUNTS = [12, 15, 16, 20, 21, 24, 28, 32] as const;

function bandsForCount(boardCount: number) {
  return boardCount === 24
    ? STANDARD_24_BOARD_VP_BANDS
    : getWbfVpBands(boardCount);
}

function sqlValues(boardCount: number): string {
  const bands = bandsForCount(boardCount);
  return bands
    .map(
      (b) =>
        `(${b.imp_min}::numeric, ${b.imp_max}::numeric, ${b.vp_home}::numeric, ${b.vp_away}::numeric)`,
    )
    .join(",\n    ");
}

console.log(`-- Auto-generated VP table rows for WBF board counts
-- Run: npx tsx scripts/generate-vp-migration-sql.ts

`);

for (const boardCount of BOARD_COUNTS) {
  if (boardCount === 24) continue; // already seeded in 0041

  console.log(`-- ${boardCount} boards`);
  console.log(`insert into public.vp_tables (group_id, board_count, name)
select g.id, ${boardCount}, 'WBF ${boardCount} boards'
from public.groups g
where not exists (
  select 1 from public.vp_tables vt
  where vt.group_id = g.id and vt.board_count = ${boardCount}
);

insert into public.vp_table_rows (vp_table_id, imp_min, imp_max, vp_home, vp_away)
select vt.id, bands.imp_min, bands.imp_max, bands.vp_home, bands.vp_away
from public.vp_tables vt
cross join (
  values
    ${sqlValues(boardCount)}
) as bands(imp_min, imp_max, vp_home, vp_away)
where vt.board_count = ${boardCount}
  and vt.name = 'WBF ${boardCount} boards'
  and not exists (
    select 1 from public.vp_table_rows r where r.vp_table_id = vt.id
  );

`);
}
