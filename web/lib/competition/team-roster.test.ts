import { describe, expect, it, vi } from "vitest";
import {
  comparePlayersByLastName,
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

describe("removePlayerFromTeamRoster", () => {
  it("removes a player from the roster, including the captain", async () => {
    const del = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    }));

    const supabase = {
      from: (table: string) => {
        if (table === "team_players") {
          return { delete: del };
        }
        throw new Error(`unexpected ${table}`);
      },
    } as never;

    await removePlayerFromTeamRoster(supabase, {
      teamId: "t1",
      playerId: "p1",
      seasonId: "s1",
    });

    expect(del).toHaveBeenCalled();
  });
});
