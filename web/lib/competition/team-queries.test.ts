import { describe, expect, it } from "vitest";
import {
  loadTeamPlayerMatchesPlayed,
  loadTeamsForUser,
  mapRawMatchToTeamMatchRow,
  withMatchesPlayed,
} from "./team-queries";

describe("loadTeamsForUser", () => {
  it("returns teams for linked player in active season", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "players") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { id: "player-1" }, error: null }),
              }),
            }),
          };
        }
        if (table === "seasons") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: "season-1", name: "2024-25", status: "active", is_active: true },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "team_players") {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [{ team: { id: "team-1", name: "Alpha" } }],
                    error: null,
                  }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as never;

    await expect(loadTeamsForUser(supabase, "user-1")).resolves.toEqual([
      { id: "team-1", name: "Alpha" },
    ]);
  });
});

describe("loadTeamPlayerMatchesPlayed", () => {
  it("counts lineup rows per player in played matches", async () => {
    const supabase = {
      from: (table: string) => {
        if (table !== "match_players") throw new Error(`unexpected ${table}`);
        return {
          select: () => ({
            eq: () => ({
              in: () =>
                Promise.resolve({
                  data: [
                    { player_id: "p1" },
                    { player_id: "p1" },
                    { player_id: "p2" },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      },
    } as never;

    const counts = await loadTeamPlayerMatchesPlayed(supabase, "team-1", [
      "m1",
      "m2",
    ]);
    expect(counts.get("p1")).toBe(2);
    expect(counts.get("p2")).toBe(1);
    expect(counts.get("p3")).toBeUndefined();
  });
});

describe("withMatchesPlayed", () => {
  it("defaults missing players to zero", () => {
    expect(
      withMatchesPlayed(
        [{ id: "p1", name: "Alice", member_number: null }],
        new Map([["p1", 3]]),
      ),
    ).toEqual([
      { id: "p1", name: "Alice", member_number: null, matches_played: 3 },
    ]);
  });
});

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
        hosting_team_id: "home-1",
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
        hosting_team_id: "home-1",
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

  it("uses hosting_team_id for home indicator without changing VP side mapping", () => {
    const row = mapRawMatchToTeamMatchRow(
      {
        id: "m3",
        round: 5,
        datetime: "2025-01-29T13:00:00Z",
        home_team_id: "home-1",
        away_team_id: "away-1",
        hosting_team_id: "away-1",
        vp_home: 11,
        vp_away: 9,
        played_at: "2025-01-29T18:00:00Z",
      },
      "away-1",
      teamNames,
    );

    expect(row.isHome).toBe(true);
    expect(row.teamVp).toBe(9);
    expect(row.opponentVp).toBe(11);
  });
});
