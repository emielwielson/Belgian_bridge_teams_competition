import { describe, expect, it, vi } from "vitest";
import {
  getActivePlayerId,
  getPlayerSelectionState,
} from "./active-player";

describe("getActivePlayerId", () => {
  it("returns active player when profile and link exist", async () => {
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
        throw new Error(`unexpected table ${table}`);
      },
    } as never;

    await expect(getActivePlayerId(supabase, "user-1")).resolves.toBe("player-1");
  });

  it("returns null when active player is not linked", async () => {
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
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as never;

    await expect(getActivePlayerId(supabase, "user-1")).resolves.toBeNull();
  });
});

describe("getPlayerSelectionState", () => {
  it("requires selection when multiple links and no active player", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "player_auth_links") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ count: 2, error: null }),
            }),
          };
        }
        if (table === "user_profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { active_player_id: null }, error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      rpc: vi.fn(),
    } as never;

    await expect(getPlayerSelectionState(supabase, "user-1")).resolves.toEqual({
      linkedCount: 2,
      activePlayerId: null,
      needsSelection: true,
    });
  });
});
