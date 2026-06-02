import { describe, expect, it } from "vitest";
import { parsePenaltyInput } from "./penalties";

describe("parsePenaltyInput", () => {
  it("parses valid penalty payload", () => {
    const result = parsePenaltyInput({
      team_id: "team-1",
      penalty_date: "2025-01-15",
      reason: "Late lineup",
      vp_deduction: 2,
      file_path: "penalties/team-1/doc.pdf",
    });
    expect(result).toEqual({
      teamId: "team-1",
      penaltyDate: "2025-01-15",
      reason: "Late lineup",
      vpDeduction: 2,
      filePath: "penalties/team-1/doc.pdf",
    });
  });

  it("rejects missing motivation", () => {
    const result = parsePenaltyInput({
      team_id: "team-1",
      penalty_date: "2025-01-15",
      reason: "  ",
      vp_deduction: 1,
    });
    expect(result).toEqual({ error: "team_id, penalty_date, and reason are required" });
  });
});
