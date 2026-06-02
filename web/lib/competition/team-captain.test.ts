import { describe, expect, it } from "vitest";
import {
  TeamValidationError,
  validateTeamCreateBody,
} from "./team-captain";

describe("validateTeamCreateBody", () => {
  it("returns parsed fields when valid", () => {
    expect(
      validateTeamCreateBody({
        group_id: "g1",
        club_id: "c1",
        name: " Club A ",
        captain_id: "p1",
      }),
    ).toEqual({
      group_id: "g1",
      club_id: "c1",
      name: "Club A",
      captain_id: "p1",
    });
  });

  it("throws when captain_id is missing", () => {
    expect(() =>
      validateTeamCreateBody({
        group_id: "g1",
        club_id: "c1",
        name: "Team",
      }),
    ).toThrow(TeamValidationError);
  });

  it("throws when name is empty", () => {
    expect(() =>
      validateTeamCreateBody({
        group_id: "g1",
        club_id: "c1",
        name: "   ",
        captain_id: "p1",
      }),
    ).toThrow("Team name is required");
  });
});
