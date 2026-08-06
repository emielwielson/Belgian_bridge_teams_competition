import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_PRIMARY,
  findActivePrimaryClubMember,
  loadActivePrimaryClubMembers,
  loadActivePrimaryPlayerIdsAtClub,
} from "./active-primary-membership";

function chainThatResolves(data: unknown) {
  const result = Promise.resolve({ data, error: null });
  const api: {
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: typeof result.then;
  } = {
    eq: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    then: result.then.bind(result),
  };
  api.eq.mockReturnValue(api);
  api.in.mockReturnValue(api);
  return api;
}

describe("active-primary-membership", () => {
  it("loads club members filtered to active primary", async () => {
    const chain = chainThatResolves([{ player_id: "p1" }]);
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => chain),
      })),
    } as never;

    const rows = await loadActivePrimaryClubMembers(
      supabase,
      "club-1",
      "player_id",
    );

    expect(supabase.from).toHaveBeenCalledWith("player_club_memberships");
    expect(chain.eq).toHaveBeenCalledWith("club_id", "club-1");
    expect(chain.eq).toHaveBeenCalledWith(
      "membership_type",
      ACTIVE_PRIMARY.membership_type,
    );
    expect(chain.eq).toHaveBeenCalledWith("status", ACTIVE_PRIMARY.status);
    expect(rows).toEqual([{ player_id: "p1" }]);
  });

  it("finds a single active primary membership", async () => {
    const chain = chainThatResolves({ id: "m1" });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => chain),
      })),
    } as never;

    const row = await findActivePrimaryClubMember(supabase, {
      clubId: "c1",
      playerId: "p1",
    });

    expect(chain.eq).toHaveBeenCalledWith("club_id", "c1");
    expect(chain.eq).toHaveBeenCalledWith("player_id", "p1");
    expect(chain.eq).toHaveBeenCalledWith("membership_type", "primary");
    expect(chain.eq).toHaveBeenCalledWith("status", "active");
    expect(row).toEqual({ id: "m1" });
  });

  it("returns player ids with active primary at club", async () => {
    const chain = chainThatResolves([
      { player_id: "p1" },
      { player_id: "p2" },
    ]);
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => chain),
      })),
    } as never;

    const ids = await loadActivePrimaryPlayerIdsAtClub(supabase, "c1", [
      "p1",
      "p2",
      "p3",
    ]);

    expect(chain.eq).toHaveBeenCalledWith("club_id", "c1");
    expect(chain.in).toHaveBeenCalledWith("player_id", ["p1", "p2", "p3"]);
    expect(chain.eq).toHaveBeenCalledWith("membership_type", "primary");
    expect(chain.eq).toHaveBeenCalledWith("status", "active");
    expect(ids).toEqual(new Set(["p1", "p2"]));
  });
});
