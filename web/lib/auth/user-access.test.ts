import { describe, expect, it, vi } from "vitest";
import { canAccessClubManagerRoute } from "./user-access";
import { ROLES } from "./roles";

describe("canAccessClubManagerRoute", () => {
  it("allows competition managers without assignment", async () => {
    const supabase = { from: vi.fn() } as never;
    await expect(
      canAccessClubManagerRoute(
        supabase,
        "user-1",
        [ROLES.COMPETITION_MANAGER],
        "/club-manager/club-1",
      ),
    ).resolves.toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("allows users assigned to the club without club_manager role", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [{ club_id: "club-1" }],
              error: null,
            }),
        }),
      }),
    } as never;

    await expect(
      canAccessClubManagerRoute(supabase, "user-1", [], "/club-manager/club-1"),
    ).resolves.toBe(true);
  });

  it("allows nested team routes for assigned clubs", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [{ club_id: "club-1" }],
              error: null,
            }),
        }),
      }),
    } as never;

    await expect(
      canAccessClubManagerRoute(
        supabase,
        "user-1",
        [],
        "/club-manager/club-1/teams/team-9",
      ),
    ).resolves.toBe(true);
  });

  it("denies users not assigned to the club", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [{ club_id: "club-other" }],
              error: null,
            }),
        }),
      }),
    } as never;

    await expect(
      canAccessClubManagerRoute(supabase, "user-1", [], "/club-manager/club-1"),
    ).resolves.toBe(false);
  });
});
