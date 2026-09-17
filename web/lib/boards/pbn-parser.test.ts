import { describe, expect, it } from "vitest";
import { parsePbn, parseDealTag } from "./pbn-parser";
import { validateBoards } from "./board-validator";

const SAMPLE_PBN = `
[Board "1"]
[Dealer "N"]
[Vulnerable "None"]
[Deal "N:KJ5.Q4.AJ63.9732 832.85.KT72.Q865 AT974.AT92..AKJT Q6.KJ763.Q9854.4"]
`;

describe("parsePbn", () => {
  it("parses a single board with 52 cards", () => {
    const result = parsePbn(SAMPLE_PBN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.boards).toHaveLength(1);
    expect(result.boards[0]?.boardNumber).toBe(1);
    expect(result.boards[0]?.dealer).toBe("N");
    expect(validateBoards(result.boards)).toEqual([]);
  });

  it("parses deal tag clockwise from start seat", () => {
    const hands = parseDealTag(
      "E:AKQ.xxx.xxx.xxx xxx.AKQ.xxx.xxx xxx.xxx.AKQ.xxx xxx.xxx.xxx.AKQ",
    );
    expect(hands).not.toBeNull();
    expect(hands?.E.S).toBe("AKQ");
  });
});
