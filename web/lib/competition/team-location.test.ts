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
        location: "  Membership address  ",
        competition_location: "   ",
      }),
    ).toBe("Membership address");
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
        location: "Membership address",
        competition_location: "Override venue",
      }),
    ).toBe("Override venue");
    expect(teamLocationFromClub({ location: "  Clubhouse  " })).toBe("Clubhouse");
  });

  it("returns null when club location is empty", () => {
    expect(teamLocationFromClub({ location: "   " })).toBeNull();
    expect(teamLocationFromClub(null)).toBeNull();
  });
});
