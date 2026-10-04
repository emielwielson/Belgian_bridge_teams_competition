import { describe, expect, it, vi } from "vitest";
import {
  loadNextUnplayedMatchForTeam,
  resolveUserTeamIds,
} from "./player-matches";

vi.mock("@/lib/competition/season", () => ({
  getActiveSeason: vi.fn().mockResolvedValue({
    id: "season-1",
    name: "2025-26",
    status: "active",
    is_active: true,
  }),
}));

type MatchRow = {
  id: string;
  round: number;
  datetime: string;
  played_at: string | null;
  home_team_id: string;
  away_team_id: string;
  group_id: string;
};

function createSupabase(options: {
  homeMatches?: MatchRow[];
  awayMatches?: MatchRow[];
  teams?: { id: string; name: string }[];
}) {
  const homeMatches = options.homeMatches ?? [];
  const awayMatches = options.awayMatches ?? [];
  const teams = options.teams ?? [];

  return {
    from: (table: string) => {
      if (table === "matches") {
        return {
          select: () => ({
            in: (column: string) => ({
              is: () =>
                Promise.resolve({
                  data:
                    column === "home_team_id" ? homeMatches : awayMatches,
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "teams") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: teams, error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as never;
}

function resolveUserTeamIdsSupabase(options: {
  playerId?: string | null;
  rosterTeamIds?: string[];
  captainTeamIds?: string[];
}) {
  const playerId = options.playerId ?? "player-1";
  const rosterTeamIds = options.rosterTeamIds ?? [];
  const captainTeamIds = options.captainTeamIds ?? [];

  return {
    from: (table: string) => {
      if (table === "user_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { active_player_id: playerId },
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
                  Promise.resolve({ data: { player_id: playerId }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "team_players") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: rosterTeamIds.map((team_id) => ({ team_id })),
                error: null,
              }),
          }),
        };
      }
      if (table === "teams") {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({
                  data: captainTeamIds.map((id) => ({ id })),
                  error: null,
                }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as never;
}

describe("resolveUserTeamIds", () => {
  it("returns roster teams", async () => {
    const supabase = resolveUserTeamIdsSupabase({
      rosterTeamIds: ["team-a"],
    });
    await expect(resolveUserTeamIds(supabase, "user-1")).resolves.toEqual(
      new Set(["team-a"]),
    );
  });

  it("includes captained teams that are not on the roster", async () => {
    const supabase = resolveUserTeamIdsSupabase({
      rosterTeamIds: [],
      captainTeamIds: ["team-b"],
    });
    await expect(resolveUserTeamIds(supabase, "user-1")).resolves.toEqual(
      new Set(["team-b"]),
    );
  });

  it("unions roster and captained teams without duplicates", async () => {
    const supabase = resolveUserTeamIdsSupabase({
      rosterTeamIds: ["team-a", "team-b"],
      captainTeamIds: ["team-a", "team-c"],
    });
    await expect(resolveUserTeamIds(supabase, "user-1")).resolves.toEqual(
      new Set(["team-a", "team-b", "team-c"]),
    );
  });
});

describe("loadNextUnplayedMatchForTeam", () => {
  it("returns null when there are no unplayed matches", async () => {
    const supabase = createSupabase({
      homeMatches: [],
      awayMatches: [],
    });
    await expect(
      loadNextUnplayedMatchForTeam(supabase, "team-a"),
    ).resolves.toBeNull();
  });

  it("returns the earliest unplayed match by datetime for that team", async () => {
    const supabase = createSupabase({
      homeMatches: [
        {
          id: "match-later",
          round: 2,
          datetime: "2026-02-01T19:00:00Z",
          played_at: null,
          home_team_id: "team-a",
          away_team_id: "team-b",
          group_id: "group-1",
        },
      ],
      awayMatches: [
        {
          id: "match-earlier",
          round: 1,
          datetime: "2026-01-15T19:00:00Z",
          played_at: null,
          home_team_id: "team-c",
          away_team_id: "team-a",
          group_id: "group-1",
        },
      ],
      teams: [
        { id: "team-a", name: "Alpha" },
        { id: "team-b", name: "Beta" },
        { id: "team-c", name: "Charlie" },
      ],
    });

    await expect(
      loadNextUnplayedMatchForTeam(supabase, "team-a"),
    ).resolves.toEqual({
      id: "match-earlier",
      round: 1,
      datetime: "2026-01-15T19:00:00Z",
      played_at: null,
      home_team: { id: "team-c", name: "Charlie" },
      away_team: { id: "team-a", name: "Alpha" },
    });
  });
});
