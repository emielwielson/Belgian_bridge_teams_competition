import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_PRIMARY,
  findActivePrimaryClubMember,
  findEligibleClubMember,
  isEligibleMembershipRow,
  loadActivePrimaryClubMembers,
  loadActivePrimaryPlayerIdsAtClub,
  loadEligibleClubMembers,
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

describe("isEligibleMembershipRow", () => {
  it("requires active primary for national", () => {
    expect(
      isEligibleMembershipRow(
        { membership_type: "primary", status: "active" },
        "national",
      ),
    ).toBe(true);
    expect(
      isEligibleMembershipRow(
        { membership_type: "primary", status: "archived" },
        "national",
      ),
    ).toBe(false);
    expect(
      isEligibleMembershipRow(
        { membership_type: "second", status: "archived" },
        "national",
      ),
    ).toBe(false);
  });

  it("allows Zweiffel primary only when active", () => {
    expect(
      isEligibleMembershipRow(
        { membership_type: "primary", status: "active" },
        "zweiffel",
      ),
    ).toBe(true);
    expect(
      isEligibleMembershipRow(
        { membership_type: "primary", status: "archived" },
        "zweiffel",
      ),
    ).toBe(false);
  });

  it("allows Zweiffel second and federation regardless of status", () => {
    expect(
      isEligibleMembershipRow(
        { membership_type: "second", status: "archived" },
        "zweiffel",
      ),
    ).toBe(true);
    expect(
      isEligibleMembershipRow(
        { membership_type: "federation", status: "active" },
        "zweiffel",
      ),
    ).toBe(true);
    expect(
      isEligibleMembershipRow(
        { membership_type: "federation", status: "archived" },
        "zweiffel",
      ),
    ).toBe(true);
  });
});

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

  it("loads Zweiffel members without global status filter and dedupes players", async () => {
    const chain = chainThatResolves([
      {
        player_id: "p1",
        membership_type: "federation",
        status: "active",
        player: { id: "p1", name: "Dirk" },
      },
      {
        player_id: "p1",
        membership_type: "second",
        status: "archived",
        player: { id: "p1", name: "Dirk" },
      },
      {
        player_id: "p2",
        membership_type: "primary",
        status: "archived",
        player: { id: "p2", name: "Skip" },
      },
      {
        player_id: "p3",
        membership_type: "second",
        status: "archived",
        player: { id: "p3", name: "Erik" },
      },
    ]);
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => chain),
      })),
    } as never;

    const rows = await loadEligibleClubMembers(
      supabase,
      "club-1",
      "player_id, player:players(id, name)",
      "zweiffel",
    );

    expect(chain.eq).toHaveBeenCalledWith("club_id", "club-1");
    expect(chain.eq).not.toHaveBeenCalledWith("status", "active");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => (r as { player_id: string }).player_id)).toEqual([
      "p1",
      "p3",
    ]);
  });

  it("finds Zweiffel captain via archived second membership", async () => {
    const chain = chainThatResolves([
      { id: "m-fed", membership_type: "federation", status: "active" },
      { id: "m-sec", membership_type: "second", status: "archived" },
    ]);
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => chain),
      })),
    } as never;

    const row = await findEligibleClubMember(supabase, {
      clubId: "c1",
      playerId: "p1",
      competitionKindCode: "zweiffel",
    });

    expect(chain.eq).not.toHaveBeenCalledWith("status", "active");
    expect(row).toEqual({ id: "m-fed" });
  });
});
