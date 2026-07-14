import { describe, expect, it } from "vitest";
import { resolveTeamMatchLocation, teamLocationFromClub } from "./team-location";

describe("resolveTeamMatchLocation", () => {
  const club = {
    location: "Membership address",
    competition_location: "Override venue",
  };

  it("uses division centralized location when set", () => {
    expect(
      resolveTeamMatchLocation(club, { centralized_location: "  Central hall  " }),
    ).toBe("Central hall");
  });

  it("uses club competition_location override when no centralized location", () => {
    expect(resolveTeamMatchLocation(club)).toBe("Override venue");
  });

  it("falls back to membership club location when override is empty", () => {
    expect(
      resolveTeamMatchLocation({
        address: "Veldstraat 3",
        postal_code: "9000",
        location: "Gent",
        competition_location: "   ",
      }),
    ).toBe("Veldstraat 3 - 9000 - Gent");
  });

  it("returns null when no location is available", () => {
    expect(resolveTeamMatchLocation(null)).toBeNull();
    expect(resolveTeamMatchLocation({ location: "   " })).toBeNull();
  });
});

describe("teamLocationFromClub", () => {
  it("returns override or membership location without division context", () => {
    expect(
      teamLocationFromClub({
        address: "Street 1",
        postal_code: "1000",
        location: "Brussels",
        competition_location: "Override venue",
      }),
    ).toBe("Override venue");
    expect(
      teamLocationFromClub({
        address: "Street 1",
        location: "  Clubhouse city  ",
      }),
    ).toBe("Street 1 - Clubhouse city");
  });

  it("returns null when club location is empty", () => {
    expect(teamLocationFromClub({ location: "   " })).toBeNull();
    expect(teamLocationFromClub(null)).toBeNull();
  });
});
