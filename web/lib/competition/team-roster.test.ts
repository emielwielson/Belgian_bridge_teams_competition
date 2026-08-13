import { describe, expect, it, vi } from "vitest";
import {
  comparePlayersByLastName,
  ensureCaptainOnTeamRoster,
  removePlayerFromTeamRoster,
} from "./team-roster";

describe("comparePlayersByLastName", () => {
  it("sorts by last_name then first_name then name", () => {
    const players = [
      {
        name: "Alice Peeters",
        first_name: "Alice",
        last_name: "Peeters",
      },
      {
        name: "Bob Janssens",
        first_name: "Bob",
        last_name: "Janssens",
      },
      {
        name: "Carla Peeters",
        first_name: "Carla",
        last_name: "Peeters",
      },
    ];

    const sorted = [...players].sort(comparePlayersByLastName);
    expect(sorted.map((p) => p.name)).toEqual([
      "Bob Janssens",
      "Alice Peeters",
      "Carla Peeters",
    ]);
  });

  it("treats null name parts as empty", () => {
    const players = [
      { name: "Zed", first_name: null, last_name: null },
      { name: "Ann Smith", first_name: "Ann", last_name: "Smith" },
      { name: "Only", first_name: "Only", last_name: null },
    ];

    const sorted = [...players].sort(comparePlayersByLastName);
    // Empty last_name first; among those, empty first_name before "Only"
    expect(sorted.map((p) => p.name)).toEqual([
      "Zed",
      "Only",
      "Ann Smith",
    ]);
  });
});

describe("ensureCaptainOnTeamRoster", () => {
  it("no-ops when captain is already on the team roster", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { team_id: "t1" }, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as never;

    await expect(
      ensureCaptainOnTeamRoster(supabase, {
        teamId: "t1",
        captainId: "p1",
        seasonId: "s1",
      }),
    ).resolves.toBeUndefined();
  });

  it("inserts when captain is not on any roster", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    let teamPlayersCalls = 0;

    const supabase = {
      rpc: () => Promise.resolve({ data: false, error: null }),
      from: (table: string) => {
        if (table !== "team_players") throw new Error(`unexpected ${table}`);
        teamPlayersCalls += 1;
        if (teamPlayersCalls === 3) {
          return { insert };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: null, error: null }),
                }),
                maybeSingle: () =>
                  Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      },
    } as never;

    await ensureCaptainOnTeamRoster(supabase, {
      teamId: "t1",
      captainId: "p1",
      seasonId: "s1",
    });

    expect(insert).toHaveBeenCalledWith({
      team_id: "t1",
      player_id: "p1",
      season_id: "s1",
    });
  });

  it("rejects when captain is on another team", async () => {
    let teamPlayersCalls = 0;
    const supabase = {
      from: () => {
        teamPlayersCalls += 1;
        if (teamPlayersCalls === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () =>
                      Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { team_id: "t-other" }, error: null }),
              }),
            }),
          }),
        };
      },
    } as never;

    await expect(
      ensureCaptainOnTeamRoster(supabase, {
        teamId: "t1",
        captainId: "p1",
        seasonId: "s1",
      }),
    ).rejects.toThrow(/another team/);
  });
});

describe("removePlayerFromTeamRoster", () => {
  it("rejects removing the team captain", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "teams") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { captain_id: "p1" }, error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected ${table}`);
      },
    } as never;

    await expect(
      removePlayerFromTeamRoster(supabase, {
        teamId: "t1",
        playerId: "p1",
        seasonId: "s1",
      }),
    ).rejects.toThrow(/captain/);
  });

  it("removes a non-captain player from the roster", async () => {
    const del = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    }));

    const supabase = {
      from: (table: string) => {
        if (table === "teams") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { captain_id: "p1" }, error: null }),
              }),
            }),
          };
        }
        if (table === "team_players") {
          return { delete: del };
        }
        throw new Error(`unexpected ${table}`);
      },
    } as never;

    await removePlayerFromTeamRoster(supabase, {
      teamId: "t1",
      playerId: "p2",
      seasonId: "s1",
    });

    expect(del).toHaveBeenCalled();
  });
});
