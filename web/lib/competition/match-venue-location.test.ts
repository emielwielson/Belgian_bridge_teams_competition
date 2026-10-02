import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadMatchVenueLocation,
  locationFromVenueTeamRow,
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

describe("locationFromVenueTeamRow", () => {
  it("resolves team override and club address", () => {
    expect(
      locationFromVenueTeamRow({
        location: "  Team hall  ",
        club: {
          address: "Street 1",
          postal_code: "1000",
          location: "Brussels",
          competition_location: null,
        },
        group: { division: { centralized_location: null } },
      }),
    ).toBe("Team hall");
  });

  it("returns null for missing team", () => {
    expect(locationFromVenueTeamRow(null)).toBeNull();
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

describe("loadMatchVenueLocation", () => {
  it("resolves hosting away team from a single match query", async () => {
    const select = matchChain({
      home_team_id: "home-1",
      hosting_team_id: "away-1",
      home_team: {
        location: "Home hall",
        club: { competition_location: "Home club" },
        group: { division: { centralized_location: null } },
      },
      away_team: {
        location: "  Away club hall  ",
        club: {
          address: "Street 1",
          postal_code: "1000",
          location: "Brussels",
          competition_location: null,
        },
        group: { division: { centralized_location: null } },
      },
    });

    const from = vi.fn(() => ({ select: vi.fn(() => select) }));

    const location = await loadMatchVenueLocation(
      { from } as unknown as SupabaseClient,
      { id: "m1", home_team_id: "home-1" },
    );

    expect(location).toBe("Away club hall");
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("matches");
  });

  it("falls back to home team when hosting_team_id column is missing", async () => {
    const first = matchChain(null, {
      code: "42703",
      message: "column matches.hosting_team_id does not exist",
    });
    const second = matchChain({
      home_team_id: "home-1",
      home_team: {
        location: null,
        club: {
          address: "Rue 2",
          postal_code: "4000",
          location: "Liège",
          competition_location: null,
        },
        group: { division: { centralized_location: null } },
      },
    });

    let call = 0;
    const from = vi.fn(() => ({
      select: vi.fn(() => {
        call += 1;
        return call === 1 ? first : second;
      }),
    }));

    const location = await loadMatchVenueLocation(
      { from } as unknown as SupabaseClient,
      { id: "m1", home_team_id: "home-1" },
    );

    expect(location).toBe("Rue 2 - 4000 - Liège");
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("uses division centralized venue when present", async () => {
    const select = matchChain({
      home_team_id: "home-1",
      hosting_team_id: "home-1",
      home_team: {
        location: "Team override",
        club: {
          competition_location: "Club override",
          location: "City",
        },
        group: {
          division: { centralized_location: "  Central hall  " },
        },
      },
      away_team: {
        location: null,
        club: null,
        group: null,
      },
    });

    const from = vi.fn(() => ({ select: vi.fn(() => select) }));

    const location = await loadMatchVenueLocation(
      { from } as unknown as SupabaseClient,
      { id: "m1", home_team_id: "home-1" },
    );

    expect(location).toBe("Central hall");
  });

  it("returns null when the match cannot be loaded", async () => {
    const select = matchChain(null);
    const from = vi.fn(() => ({ select: vi.fn(() => select) }));

    const location = await loadMatchVenueLocation(
      { from } as unknown as SupabaseClient,
      { id: "m1", home_team_id: "home-1" },
    );

    expect(location).toBeNull();
  });
});
