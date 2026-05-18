import { describe, expect, it } from "vitest";
import {
  buildGroupStandingsGrid,
  PAIRING_BG_CLASSES,
  type GroupMatchRow,
  type StandingsTeamRow,
} from "./group-standings-grid";

const teams: StandingsTeamRow[] = [
  { team_id: "t1", team_name: "Alpha", vp_total: 20 },
  { team_id: "t2", team_name: "Bravo", vp_total: 15 },
  { team_id: "t3", team_name: "Charlie", vp_total: 10 },
];

function match(overrides: Partial<GroupMatchRow> & Pick<GroupMatchRow, "round">): GroupMatchRow {
  const round = overrides.round;
  return {
    id: `m-${round}`,
    datetime: "2024-10-04T12:00:00.000Z",
    home_team_id: "t1",
    away_team_id: "t2",
    vp_home: 12,
    vp_away: 8,
    played_at: "2024-10-05T12:00:00.000Z",
    ...overrides,
    round,
  };
}

describe("buildGroupStandingsGrid", () => {
  it("orders round columns ascending", () => {
    const matches = [
      match({ round: 2, id: "m2", home_team_id: "t1", away_team_id: "t3" }),
      match({ round: 1, id: "m1" }),
    ];
    const grid = buildGroupStandingsGrid(teams, matches);
    expect(grid.rounds.map((r) => r.round)).toEqual([1, 2]);
    expect(grid.rounds[0].dateLabel).toBeTruthy();
    expect(grid.rounds[0].timeLabel).toBeTruthy();
  });

  it("maps VP and home flag for scored matches", () => {
    const matches = [match({ round: 1, vp_home: 14, vp_away: 6 })];
    const grid = buildGroupStandingsGrid(teams, matches);
    const alpha = grid.rows.find((r) => r.teamId === "t1")!;
    const bravo = grid.rows.find((r) => r.teamId === "t2")!;
    expect(alpha.cells[0].vp).toBe(14);
    expect(alpha.cells[0].isHome).toBe(true);
    expect(bravo.cells[0].vp).toBe(6);
    expect(bravo.cells[0].isHome).toBe(false);
  });

  it("leaves VP null when match is not scored", () => {
    const matches = [match({ round: 1, played_at: null })];
    const grid = buildGroupStandingsGrid(teams, matches);
    expect(grid.rows[0].cells[0].vp).toBeNull();
    expect(grid.rows[0].cells[0].pairingClass).toBe(PAIRING_BG_CLASSES[0]);
  });

  it("assigns the same pairing background to both teams in a fixture", () => {
    const matches = [match({ round: 1 })];
    const grid = buildGroupStandingsGrid(teams, matches);
    const alpha = grid.rows.find((r) => r.teamId === "t1")!;
    const bravo = grid.rows.find((r) => r.teamId === "t2")!;
    expect(alpha.cells[0].pairingClass).toBe(bravo.cells[0].pairingClass);
    expect(alpha.cells[0].pairingClass).toBe(PAIRING_BG_CLASSES[0]);
  });

  it("uses different pairing colors for separate fixtures in the same round", () => {
    const matches = [
      match({ round: 1, id: "m1", home_team_id: "t1", away_team_id: "t2" }),
      match({ round: 1, id: "m2", home_team_id: "t3", away_team_id: "t4" }),
    ];
    const grid = buildGroupStandingsGrid(teams, matches);
    const t1cell = grid.rows.find((r) => r.teamId === "t1")!.cells[0];
    const t3cell = grid.rows.find((r) => r.teamId === "t3")!.cells[0];
    expect(t1cell.pairingClass).not.toBe(t3cell.pairingClass);
  });

  it("preserves standings rank order and totals", () => {
    const grid = buildGroupStandingsGrid(teams, []);
    expect(grid.hasMatches).toBe(false);
    expect(grid.rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(grid.rows[0].vpTotal).toBe(20);
  });
});
