import { describe, expect, it } from "vitest";
import { loadNextUnplayedMatchForTeam } from "./player-matches";

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
