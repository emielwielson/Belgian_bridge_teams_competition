import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadMatchVenueLocation,
  venueTeamIdForMatch,
} from "./match-venue-location";

describe("venueTeamIdForMatch", () => {
  it("uses home_team_id when hosting_team_id is null or missing", () => {
    expect(
      venueTeamIdForMatch({ home_team_id: "home-1", hosting_team_id: null }),
    ).toBe("home-1");
    expect(venueTeamIdForMatch({ home_team_id: "home-1" })).toBe("home-1");
  });

  it("prefers hosting_team_id after a home/away switch", () => {
    expect(
      venueTeamIdForMatch({
        home_team_id: "home-1",
        hosting_team_id: "away-1",
      }),
    ).toBe("away-1");
  });
});

function matchChain(data: unknown, error: unknown = null) {
  const api = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  api.eq.mockReturnValue(api);
  return api;
}

function teamChain(data: unknown, error: unknown = null) {
  const api = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  api.eq.mockReturnValue(api);
  return api;
}

describe("loadMatchVenueLocation", () => {
  it("resolves the hosting team's location when hosting differs from home", async () => {
    const matchSelect = matchChain({
      home_team_id: "home-1",
      hosting_team_id: "away-1",
    });
    const teamSelect = teamChain({
      id: "away-1",
      location: "  Away club hall  ",
      club: {
        address: "Street 1",
        postal_code: "1000",
        location: "Brussels",
        competition_location: null,
      },
      group: {
        division: { centralized_location: null },
      },
    });

    const from = vi.fn((table: string) => {
      if (table === "matches") {
        return { select: vi.fn(() => matchSelect) };
      }
      return { select: vi.fn(() => teamSelect) };
    });

    const location = await loadMatchVenueLocation(
      { from } as unknown as SupabaseClient,
      { id: "m1", home_team_id: "home-1" },
    );

    expect(location).toBe("Away club hall");
    expect(teamSelect.eq).toHaveBeenCalledWith("id", "away-1");
  });

  it("falls back to home team when hosting_team_id column is missing", async () => {
    const matchSelect = matchChain(null, {
      code: "42703",
      message: 'column matches.hosting_team_id does not exist',
    });
    const teamSelect = teamChain({
      id: "home-1",
      location: null,
      club: {
        address: "Rue 2",
        postal_code: "4000",
        location: "Liège",
        competition_location: null,
      },
      group: {
        division: { centralized_location: null },
      },
    });

    const from = vi.fn((table: string) => {
      if (table === "matches") {
        return { select: vi.fn(() => matchSelect) };
      }
      return { select: vi.fn(() => teamSelect) };
    });

    const location = await loadMatchVenueLocation(
      { from } as unknown as SupabaseClient,
      { id: "m1", home_team_id: "home-1" },
    );

    expect(location).toBe("Rue 2 - 4000 - Liège");
    expect(teamSelect.eq).toHaveBeenCalledWith("id", "home-1");
  });

  it("uses division centralized venue when present", async () => {
    const matchSelect = matchChain({
      home_team_id: "home-1",
      hosting_team_id: "home-1",
    });
    const teamSelect = teamChain({
      id: "home-1",
      location: "Team override",
      club: {
        competition_location: "Club override",
        location: "City",
      },
      group: {
        division: { centralized_location: "  Central hall  " },
      },
    });

    const from = vi.fn((table: string) => {
      if (table === "matches") {
        return { select: vi.fn(() => matchSelect) };
      }
      return { select: vi.fn(() => teamSelect) };
    });

    const location = await loadMatchVenueLocation(
      { from } as unknown as SupabaseClient,
      { id: "m1", home_team_id: "home-1" },
    );

    expect(location).toBe("Central hall");
  });

  it("returns null when the hosting team cannot be loaded", async () => {
    const matchSelect = matchChain({
      home_team_id: "home-1",
      hosting_team_id: null,
    });
    const teamSelect = teamChain(null);

    const from = vi.fn((table: string) => {
      if (table === "matches") {
        return { select: vi.fn(() => matchSelect) };
      }
      return { select: vi.fn(() => teamSelect) };
    });

    const location = await loadMatchVenueLocation(
      { from } as unknown as SupabaseClient,
      { id: "m1", home_team_id: "home-1" },
    );

    expect(location).toBeNull();
  });
});
