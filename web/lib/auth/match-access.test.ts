import { describe, expect, it, vi } from "vitest";
import { canEditLineupForTeam, type MatchContext } from "./match-access";
import { ROLES } from "./roles";

const baseMatch: MatchContext = {
  id: "match-1",
  group_id: "group-1",
  round: 1,
  datetime: "2025-01-01T12:00:00Z",
  home_team_id: "home-1",
  away_team_id: "away-1",
  board_count: 24,
  vp_board_count: null,
  mis_seating: false,
  selected_board_count: null,
  imps_home: null,
  imps_away: null,
  vp_home: null,
  vp_away: null,
  played_at: null,
  home_team: { id: "home-1", name: "Home", club_id: "club-1" },
  away_team: { id: "away-1", name: "Away", club_id: "club-2" },
};

function mockSupabase(options: {
  canEditLineup?: boolean;
  playerId?: string | null;
  rosterTeamIds?: string[];
}) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: options.canEditLineup ?? true,
      error: null,
    }),
    from: (table: string) => {
      if (table === "user_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: options.playerId
                    ? { active_player_id: options.playerId }
                    : { active_player_id: null },
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
                  Promise.resolve({
                    data: options.playerId ? { player_id: options.playerId } : null,
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "team_players") {
        const roster = new Set(options.rosterTeamIds ?? []);
        return {
          select: () => ({
            eq: () => ({
              eq: (_col: string, teamId: string) => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: roster.has(teamId) ? { team_id: teamId } : null,
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as never;
}

describe("canEditLineupForTeam", () => {
  it("lets a match player edit both home and away lineups", async () => {
    const supabase = mockSupabase({
      playerId: "player-1",
      rosterTeamIds: [baseMatch.home_team_id],
    });

    await expect(
      canEditLineupForTeam(
        supabase,
        "user-1",
        [ROLES.PLAYER],
        baseMatch,
        baseMatch.home_team_id,
      ),
    ).resolves.toBe(true);
    await expect(
      canEditLineupForTeam(
        supabase,
        "user-1",
        [ROLES.PLAYER],
        baseMatch,
        baseMatch.away_team_id,
      ),
    ).resolves.toBe(true);
  });

  it("denies when match is already played", async () => {
    const supabase = mockSupabase({
      playerId: "player-1",
      rosterTeamIds: [baseMatch.home_team_id],
    });

    await expect(
      canEditLineupForTeam(
        supabase,
        "user-1",
        [ROLES.PLAYER],
        { ...baseMatch, played_at: "2025-01-02T12:00:00Z" },
        baseMatch.home_team_id,
      ),
    ).resolves.toBe(false);
  });
});
