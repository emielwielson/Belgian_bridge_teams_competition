import { describe, expect, it } from "vitest";
import {
  loadTeamDetail,
  loadTeamPlayerMatchesPlayed,
  loadTeamsForUser,
  mapRawMatchToTeamMatchRow,
  withMatchesPlayed,
} from "./team-queries";

function createLoadTeamDetailSupabase(options: {
  onTeamSelect: (columns: string) => void;
  captain: {
    id: string;
    name: string;
    member_number: string | null;
    email?: string | null;
    phone?: string | null;
    mobile_phone?: string | null;
  };
}) {
  return {
    from: (table: string) => {
      if (table === "teams") {
        return {
          select: (columns: string) => {
            options.onTeamSelect(columns);
            return {
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: "team-1",
                      name: "Alpha",
                      location: null,
                      captain_id: options.captain.id,
                      captain: options.captain,
                      club: {
                        id: "club-1",
                        name: "Club",
                        address: null,
                        postal_code: null,
                        location: "Brussels",
                        competition_location: null,
                      },
                      group: {
                        id: "group-1",
                        name: "Group A",
                        division: {
                          id: "div-1",
                          name: "Division 1",
                          centralized_location: null,
                          league: { id: "league-1", name: "League" },
                        },
                      },
                    },
                    error: null,
                  }),
                in: () => Promise.resolve({ data: [], error: null }),
              }),
            };
          },
        };
      }
      if (table === "seasons") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: "season-1",
                    name: "2024-25",
                    status: "active",
                    is_active: true,
                  },
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
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "matches") {
        return {
          select: () => ({
            or: () => ({
              order: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "match_players") {
        return {
          select: () => ({
            eq: () => ({
              in: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as never;
}

describe("loadTeamDetail", () => {
  const captainBase = {
    id: "player-1",
    name: "Alice",
    member_number: "100",
    email: "alice@example.com",
    phone: "+321111",
    mobile_phone: "+322222",
  };

  it("omits captain contact fields from select and result by default", async () => {
    let teamSelect = "";
    const supabase = createLoadTeamDetailSupabase({
      onTeamSelect: (columns) => {
        teamSelect = columns;
      },
      captain: captainBase,
    });

    const detail = await loadTeamDetail(supabase, "team-1");

    expect(teamSelect).toContain("captain:players(id, name, member_number)");
    expect(teamSelect).not.toContain("email");
    expect(teamSelect).not.toContain("phone");
    expect(teamSelect).not.toContain("mobile_phone");
    expect(detail?.captain).toEqual({
      id: "player-1",
      name: "Alice",
      member_number: "100",
      matches_played: 0,
    });
    expect(detail?.captain).not.toHaveProperty("email");
    expect(detail?.captain).not.toHaveProperty("phone");
    expect(detail?.captain).not.toHaveProperty("mobile_phone");
    expect(detail?.team.location).toBe("Brussels");
    expect(detail?.team.locationOverride).toBeNull();
    expect(detail?.clubLocation).toBe("Brussels");
    expect(detail?.hasCentralizedVenue).toBe(false);
  });

  it("includes captain contact fields when includeCaptainContacts is true", async () => {
    let teamSelect = "";
    const supabase = createLoadTeamDetailSupabase({
      onTeamSelect: (columns) => {
        teamSelect = columns;
      },
      captain: captainBase,
    });

    const detail = await loadTeamDetail(supabase, "team-1", {
      includeCaptainContacts: true,
    });

    expect(teamSelect).toContain(
      "captain:players(id, name, member_number, email, phone, mobile_phone)",
    );
    expect(detail?.captain).toEqual({
      id: "player-1",
      name: "Alice",
      member_number: "100",
      matches_played: 0,
      email: "alice@example.com",
      phone: "+321111",
      mobile_phone: "+322222",
    });
  });
});

describe("loadTeamsForUser", () => {
  it("returns teams for linked player in active season", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "user_profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { active_player_id: "player-1" },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "player_auth_links") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { player_id: "player-1" }, error: null }),
                }),
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
