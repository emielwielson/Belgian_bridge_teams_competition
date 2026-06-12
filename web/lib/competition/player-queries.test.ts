import { describe, expect, it } from "vitest";
import {
  aggregatePlayerAppearances,
  loadPlayerDetail,
} from "./player-queries";

const activeGroups = new Set(["group-1"]);

describe("aggregatePlayerAppearances", () => {
  it("counts appearances per team and separates subs", () => {
    const counts = aggregatePlayerAppearances(
      [
        {
          team_id: "team-a",
          is_substitute: false,
          match: { played_at: "2025-01-01", group_id: "group-1" },
        },
        {
          team_id: "team-a",
          is_substitute: false,
          match: { played_at: "2025-01-08", group_id: "group-1" },
        },
        {
          team_id: "team-b",
          is_substitute: true,
          match: { played_at: "2025-01-15", group_id: "group-1" },
        },
      ],
      activeGroups,
    );

    expect(counts.get("team-a")).toEqual({
      matches_played: 2,
      matches_as_sub: 0,
    });
    expect(counts.get("team-b")).toEqual({
      matches_played: 1,
      matches_as_sub: 1,
    });
  });

  it("ignores unplayed matches and other seasons", () => {
    const counts = aggregatePlayerAppearances(
      [
        {
          team_id: "team-a",
          is_substitute: false,
          match: { played_at: null, group_id: "group-1" },
        },
        {
          team_id: "team-a",
          is_substitute: false,
          match: { played_at: "2025-01-01", group_id: "group-other" },
        },
      ],
      activeGroups,
    );

    expect(counts.size).toBe(0);
  });
});

describe("loadPlayerDetail", () => {
  it("returns player with assigned team and appearances", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "players") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: "player-1",
                      name: "Alice",
                      member_number: "123",
                    },
                    error: null,
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
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: { team: { id: "team-a", name: "Alpha" } },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "leagues") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [{ id: "league-1" }],
                  error: null,
                }),
            }),
          };
        }
        if (table === "divisions") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [{ id: "division-1" }],
                  error: null,
                }),
            }),
          };
        }
        if (table === "groups") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [{ id: "group-1" }],
                  error: null,
                }),
            }),
          };
        }
        if (table === "match_players") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    {
                      team_id: "team-a",
                      is_substitute: false,
                      match: {
                        played_at: "2025-01-01",
                        group_id: "group-1",
                      },
                    },
                    {
                      team_id: "team-b",
                      is_substitute: true,
                      match: {
                        played_at: "2025-01-08",
                        group_id: "group-1",
                      },
                    },
                  ],
                  error: null,
                }),
            }),
          };
        }
        if (table === "teams") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [
                    { id: "team-a", name: "Alpha" },
                    { id: "team-b", name: "Beta" },
                  ],
                  error: null,
                }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as never;

    await expect(loadPlayerDetail(supabase, "player-1")).resolves.toEqual({
      player: { id: "player-1", name: "Alice", member_number: "123" },
      assigned_team: { id: "team-a", name: "Alpha" },
      appearances: [
        {
          team_id: "team-a",
          team_name: "Alpha",
          matches_played: 1,
          matches_as_sub: 0,
        },
        {
          team_id: "team-b",
          team_name: "Beta",
          matches_played: 1,
          matches_as_sub: 1,
        },
      ],
    });
  });

  it("returns null when player is missing", async () => {
    const supabase = {
      from: (table: string) => {
        if (table !== "players") throw new Error(`unexpected ${table}`);
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: null, error: null }),
            }),
          }),
        };
      },
    } as never;

    await expect(loadPlayerDetail(supabase, "missing")).resolves.toBeNull();
  });
});
