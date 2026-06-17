import { describe, expect, it } from "vitest";
import { AuthError } from "@/lib/auth/route-auth";
import { TeamCaptainError, TeamValidationError } from "@/lib/competition/team-captain";
import { codeForError, paramsForError } from "./code-for-error";
import { ErrorCodes } from "./error-codes";

describe("codeForError", () => {
  it("maps AuthError messages to codes", () => {
    expect(codeForError(new AuthError("Unauthorized", 401))).toBe(
      ErrorCodes.api.unauthorized,
    );
    expect(codeForError(new AuthError("Forbidden", 403))).toBe(
      ErrorCodes.api.forbidden,
    );
  });

  it("maps file validation errors", () => {
    expect(codeForError(new Error("File is empty"))).toBe(ErrorCodes.files.empty);
  });

  it("maps national match day errors with params", () => {
    const err = new Error("Expected 7 match days for honor, got 5");
    expect(codeForError(err)).toBe(ErrorCodes.nationalMatchDays.expectedDays);
    expect(paramsForError(err)).toEqual({
      expected: 7,
      scheduleKey: "honor",
      actual: 5,
    });
  });

  it("maps team captain errors", () => {
    expect(
      codeForError(
        new TeamCaptainError("Captain must be a member of the team's club"),
      ),
    ).toBe(ErrorCodes.api.captainNotClubMember);
  });

  it("maps captain roster validation errors", () => {
    expect(
      codeForError(
        new TeamValidationError("Cannot remove the team captain from the roster"),
      ),
    ).toBe(ErrorCodes.api.cannotRemoveCaptain);
  });

  it("returns null for unknown dynamic errors", () => {
    expect(codeForError(new Error("duplicate key value"))).toBeNull();
  });
});
