import { describe, expect, it } from "vitest";
import {
  parseWarningInput,
  parseWarningInputList,
} from "@/lib/competition/warnings";
import { ErrorCodes } from "@/lib/http/error-codes";

describe("parseWarningInput", () => {
  it("parses valid warning input", () => {
    const result = parseWarningInput({
      team_id: "team-1",
      warning_date: "2026-06-12",
      reason: " Slow play ",
    });
    expect(result).toEqual({
      teamId: "team-1",
      warningDate: "2026-06-12",
      reason: "Slow play",
    });
  });

  it("rejects missing fields", () => {
    const result = parseWarningInput({ team_id: "team-1" });
    expect(result).toEqual({ error: ErrorCodes.api.teamWarningFieldsRequired });
  });
});

describe("parseWarningInputList", () => {
  it("returns empty array for null", () => {
    expect(parseWarningInputList(null)).toEqual([]);
  });

  it("parses multiple warnings", () => {
    const result = parseWarningInputList([
      {
        team_id: "team-1",
        warning_date: "2026-06-12",
        reason: "A",
      },
      {
        team_id: "team-2",
        warning_date: "2026-06-13",
        reason: "B",
      },
    ]);
    expect(result).toHaveLength(2);
  });

  it("rejects non-array input", () => {
    const result = parseWarningInputList({ team_id: "x" });
    expect(result).toEqual({ error: ErrorCodes.api.invalidRequestBody });
  });
});
