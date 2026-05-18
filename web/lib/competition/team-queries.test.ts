import { describe, expect, it } from "vitest";
import { mapRawMatchToTeamMatchRow } from "./team-queries";

describe("mapRawMatchToTeamMatchRow", () => {
  const teamNames = new Map([
    ["home-1", "Home FC"],
    ["away-1", "Away FC"],
  ]);

  it("maps home match VP to team and opponent sides", () => {
    const row = mapRawMatchToTeamMatchRow(
      {
        id: "m1",
        round: 3,
        datetime: "2025-01-15T13:00:00Z",
        home_team_id: "home-1",
        away_team_id: "away-1",
        vp_home: 14,
        vp_away: 10,
        played_at: "2025-01-15T18:00:00Z",
      },
      "home-1",
      teamNames,
    );

    expect(row.isHome).toBe(true);
    expect(row.opponent).toEqual({ id: "away-1", name: "Away FC" });
    expect(row.status).toBe("played");
    expect(row.teamVp).toBe(14);
    expect(row.opponentVp).toBe(10);
  });

  it("maps away match VP to team and opponent sides", () => {
    const row = mapRawMatchToTeamMatchRow(
      {
        id: "m2",
        round: 4,
        datetime: "2025-01-22T13:00:00Z",
        home_team_id: "home-1",
        away_team_id: "away-1",
        vp_home: 8,
        vp_away: 16,
        played_at: null,
      },
      "away-1",
      teamNames,
    );

    expect(row.isHome).toBe(false);
    expect(row.opponent).toEqual({ id: "home-1", name: "Home FC" });
    expect(row.status).toBe("scheduled");
    expect(row.teamVp).toBe(16);
    expect(row.opponentVp).toBe(8);
  });
});
