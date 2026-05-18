import { describe, expect, it } from "vitest";
import { teamLocationFromClub } from "./team-location";

describe("teamLocationFromClub", () => {
  it("returns trimmed club location", () => {
    expect(teamLocationFromClub({ location: "  Clubhouse  " })).toBe("Clubhouse");
  });

  it("returns null when club location is empty", () => {
    expect(teamLocationFromClub({ location: "   " })).toBeNull();
    expect(teamLocationFromClub(null)).toBeNull();
  });
});
