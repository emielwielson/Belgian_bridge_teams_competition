import { describe, expect, it, vi } from "vitest";
import {
  LineupValidationError,
  validateLineupPayload,
} from "./match-operations";

function mockSupabase(options: {
  rosterIds: string[];
  clubMemberIds: string[];
}) {
  const from = vi.fn((table: string) => {
    if (table === "team_players") {
      return {
        select: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                data: options.rosterIds.map((id) => ({ player_id: id })),
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === "player_club_memberships") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: () =>
                Promise.resolve({
                  data: options.clubMemberIds.map((id) => ({ player_id: id })),
                  error: null,
                }),
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { from } as never;
}

describe("validateLineupPayload", () => {
  it("accepts roster starters and club subs not on roster", async () => {
    const supabase = mockSupabase({
      rosterIds: ["p1", "p2", "p3", "p4"],
      clubMemberIds: ["sub1"],
    });
    await expect(
      validateLineupPayload(supabase, "team-1", "club-1", "season-1", [
        { player_id: "p1", is_substitute: false },
        { player_id: "p2", is_substitute: false },
        { player_id: "p3", is_substitute: false },
        { player_id: "p4", is_substitute: false },
        { player_id: "sub1", is_substitute: true },
      ]),
    ).resolves.toBeUndefined();
  });

  it("rejects sub on team roster", async () => {
    const supabase = mockSupabase({
      rosterIds: ["p1", "p2", "p3", "p4"],
      clubMemberIds: ["p1"],
    });
    await expect(
      validateLineupPayload(supabase, "team-1", "club-1", "season-1", [
        { player_id: "p1", is_substitute: true },
        { player_id: "p2", is_substitute: false },
        { player_id: "p3", is_substitute: false },
        { player_id: "p4", is_substitute: false },
      ]),
    ).rejects.toBeInstanceOf(LineupValidationError);
  });

  it("rejects starter not on roster", async () => {
    const supabase = mockSupabase({
      rosterIds: ["p1", "p2", "p3"],
      clubMemberIds: [],
    });
    await expect(
      validateLineupPayload(supabase, "team-1", "club-1", "season-1", [
        { player_id: "p1", is_substitute: false },
        { player_id: "p2", is_substitute: false },
        { player_id: "p3", is_substitute: false },
        { player_id: "outsider", is_substitute: false },
      ]),
    ).rejects.toThrow(/team roster/);
  });
});
