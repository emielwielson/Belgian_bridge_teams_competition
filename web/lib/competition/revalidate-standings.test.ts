import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  revalidateMatchDerivedViews,
  revalidateStandingsForGroup,
} from "./revalidate-standings";
import {
  standingsGroupTag,
  standingsLeagueTag,
} from "./standings-cache";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

import { revalidatePath, revalidateTag } from "next/cache";

const groupId = "group-1";
const leagueId = "league-1";

function mockSupabaseForGroup() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: groupId,
              division: {
                id: "div-1",
                league: { id: leagueId },
              },
            },
          }),
        })),
      })),
    })),
  } as never;
}

describe("revalidateStandingsForGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expires standings tags immediately", async () => {
    await revalidateStandingsForGroup(mockSupabaseForGroup(), groupId);

    expect(revalidateTag).toHaveBeenCalledWith(
      standingsGroupTag(groupId),
      { expire: 0 },
    );
    expect(revalidateTag).toHaveBeenCalledWith(
      standingsLeagueTag(leagueId),
      { expire: 0 },
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/standings/group/${groupId}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/standings/league/${leagueId}`);
  });
});

describe("revalidateMatchDerivedViews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revalidates standings, match, teams, and players", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "groups") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: groupId,
                    division: {
                      id: "div-1",
                      league: { id: leagueId },
                    },
                  },
                }),
              })),
            })),
          };
        }
        if (table === "match_players") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [{ player_id: "player-1" }],
                error: null,
              }),
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as never;

    await revalidateMatchDerivedViews(supabase, {
      id: "match-1",
      group_id: groupId,
      home_team_id: "home-1",
      away_team_id: "away-1",
    });

    expect(revalidateTag).toHaveBeenCalledWith(
      standingsGroupTag(groupId),
      { expire: 0 },
    );
    expect(revalidateTag).toHaveBeenCalledWith(
      standingsLeagueTag(leagueId),
      { expire: 0 },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/matches/match-1");
    expect(revalidatePath).toHaveBeenCalledWith("/teams/home-1");
    expect(revalidatePath).toHaveBeenCalledWith("/teams/away-1");
    expect(revalidatePath).toHaveBeenCalledWith("/players/player-1");
  });
});
