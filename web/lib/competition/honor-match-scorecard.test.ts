import { describe, expect, it } from "vitest";
import {
  boardImpsFromDelta,
  buildScorecardBoardRows,
  contractColumnForRoom,
  displayImpsFromAssigned,
  homeScoreForRoom,
  pairNamesFromLineup,
  type ScorecardResultInput,
} from "./honor-match-scorecard";
import type { MatchLineupEntry } from "@/lib/scoring/match-operations";

function baseRow(
  overrides: Partial<ScorecardResultInput> &
    Pick<ScorecardResultInput, "boardId" | "boardNumber" | "room">,
): ScorecardResultInput {
  return {
    dealer: "N",
    vulnerability: "NONE",
    contractLevel: 3,
    contractDenomination: "NT",
    doubling: "NONE",
    declarer: "N",
    tricksResult: "=",
    nsScore: 400,
    computedScore: 400,
    adminAdjustedNsScore: null,
    includedInMatchScore: true,
    adjustmentMode: null,
    adjustmentMeta: null,
    ...overrides,
  };
}

describe("contractColumnForRoom", () => {
  it("places open-room NS declarer under home and EW under away", () => {
    expect(contractColumnForRoom("open", "N", "NT")).toBe("home");
    expect(contractColumnForRoom("open", "S", "HEARTS")).toBe("home");
    expect(contractColumnForRoom("open", "E", "HEARTS")).toBe("away");
    expect(contractColumnForRoom("open", "W", "SPADES")).toBe("away");
  });

  it("places closed-room EW declarer under home and NS under away", () => {
    expect(contractColumnForRoom("closed", "E", "HEARTS")).toBe("home");
    expect(contractColumnForRoom("closed", "W", "CLUBS")).toBe("home");
    expect(contractColumnForRoom("closed", "N", "NT")).toBe("away");
    expect(contractColumnForRoom("closed", "S", "DIAMONDS")).toBe("away");
  });

  it("puts PASS under home", () => {
    expect(contractColumnForRoom("open", null, "PASS")).toBe("home");
    expect(contractColumnForRoom("closed", null, "PASS")).toBe("home");
  });
});

describe("homeScoreForRoom / boardImpsFromDelta", () => {
  it("uses NS as home in open and −NS as home in closed", () => {
    expect(homeScoreForRoom("open", -680)).toBe(-680);
    expect(homeScoreForRoom("closed", -230)).toBe(230);
  });

  it("maps the screenshot board-29 swing (−450) to 10 IMPs away", () => {
    // openNs −680, closedNs −230 → ΔMP −450
    const delta = -680 - -230;
    expect(delta).toBe(-450);
    expect(boardImpsFromDelta(delta)).toEqual({ impsHome: 0, impsAway: 10 });
  });

  it("awards home IMPs for a positive swing", () => {
    expect(boardImpsFromDelta(20)).toEqual({ impsHome: 1, impsAway: 0 });
  });
});

describe("buildScorecardBoardRows", () => {
  it("builds home-perspective scores, ΔMP, IMPs, and contract columns", () => {
    const rows = buildScorecardBoardRows([
      baseRow({
        boardId: "b29",
        boardNumber: 29,
        room: "open",
        dealer: "N",
        vulnerability: "BOTH",
        contractLevel: 4,
        contractDenomination: "HEARTS",
        declarer: "E",
        tricksResult: "+2",
        nsScore: -680,
      }),
      baseRow({
        boardId: "b29",
        boardNumber: 29,
        room: "closed",
        dealer: "N",
        vulnerability: "BOTH",
        contractLevel: 3,
        contractDenomination: "HEARTS",
        declarer: "W",
        tricksResult: "+3",
        nsScore: -230,
      }),
    ]);

    expect(rows).toHaveLength(1);
    const board = rows[0]!;
    expect(board.kind).toBe("compared");
    expect(board.open.scoreHome).toBe(-680);
    expect(board.closed.scoreHome).toBe(230);
    expect(board.deltaMp).toBe(-450);
    expect(board.impsHome).toBe(0);
    expect(board.impsAway).toBe(10);

    // Open: EW declared → away column
    expect(board.open.homeContract).toBeNull();
    expect(board.open.awayContract?.contractLevel).toBe(4);
    // Closed: EW declared → home column
    expect(board.closed.homeContract?.contractLevel).toBe(3);
    expect(board.closed.awayContract).toBeNull();
  });

  it("marks cancelled rooms as excluded with zero IMPs", () => {
    const rows = buildScorecardBoardRows([
      baseRow({
        boardId: "b1",
        boardNumber: 1,
        room: "open",
        nsScore: 400,
      }),
      baseRow({
        boardId: "b1",
        boardNumber: 1,
        room: "closed",
        nsScore: 420,
        includedInMatchScore: false,
        adjustmentMode: "cancelled",
      }),
    ]);
    expect(rows[0]?.kind).toBe("excluded");
    expect(rows[0]?.deltaMp).toBeNull();
    expect(rows[0]?.impsHome).toBe(0);
    expect(rows[0]?.impsAway).toBe(0);
  });

  it("shows assigned average_pm IMPs without ΔMP", () => {
    const rows = buildScorecardBoardRows([
      baseRow({
        boardId: "b2",
        boardNumber: 2,
        room: "open",
        adjustmentMode: "average_pm",
        adjustmentMeta: { nsAward: "plus", ewAward: "minus" },
        includedInMatchScore: false,
        nsScore: null,
        computedScore: null,
        contractLevel: 4,
        contractDenomination: "HEARTS",
        declarer: "E",
      }),
      baseRow({
        boardId: "b2",
        boardNumber: 2,
        room: "closed",
        adjustmentMode: "average_pm",
        adjustmentMeta: { nsAward: "minus", ewAward: "plus" },
        includedInMatchScore: false,
        nsScore: null,
        computedScore: null,
      }),
    ]);
    expect(rows[0]?.kind).toBe("assigned");
    expect(rows[0]?.deltaMp).toBeNull();
    expect(displayImpsFromAssigned({ homeImps: 3, awayImps: -3 })).toEqual({
      impsHome: 3,
      impsAway: 0,
    });
    expect(rows[0]?.impsHome).toBe(3);
    expect(rows[0]?.impsAway).toBe(0);
    // Open: home=NS plus, away=EW minus — no leftover contract
    expect(rows[0]?.open.isAveragePm).toBe(true);
    expect(rows[0]?.open.averageHome).toBe("plus");
    expect(rows[0]?.open.averageAway).toBe("minus");
    expect(rows[0]?.open.homeContract).toBeNull();
    expect(rows[0]?.open.awayContract).toBeNull();
    // Closed: home=EW plus, away=NS minus
    expect(rows[0]?.closed.isAveragePm).toBe(true);
    expect(rows[0]?.closed.averageHome).toBe("plus");
    expect(rows[0]?.closed.averageAway).toBe("minus");
  });

  it("keeps open table result but shows closed average awards (board-17 style)", () => {
    const rows = buildScorecardBoardRows([
      baseRow({
        boardId: "b17",
        boardNumber: 17,
        room: "open",
        dealer: "N",
        vulnerability: "NONE",
        contractLevel: 7,
        contractDenomination: "NT",
        declarer: "N",
        tricksResult: "=",
        nsScore: 1520,
      }),
      baseRow({
        boardId: "b17",
        boardNumber: 17,
        room: "closed",
        dealer: "N",
        vulnerability: "NONE",
        contractLevel: 6,
        contractDenomination: "SPADES",
        declarer: "E",
        tricksResult: "-2",
        nsScore: null,
        computedScore: null,
        adjustmentMode: "average_pm",
        adjustmentMeta: { nsAward: "plus", ewAward: "minus" },
        includedInMatchScore: false,
      }),
    ]);
    expect(rows[0]?.kind).toBe("assigned");
    expect(rows[0]?.deltaMp).toBeNull();
    // Away = closed NS plus → +3 away
    expect(rows[0]?.impsHome).toBe(0);
    expect(rows[0]?.impsAway).toBe(3);
    expect(rows[0]?.open.isAveragePm).toBe(false);
    expect(rows[0]?.open.scoreHome).toBe(1520);
    expect(rows[0]?.open.homeContract?.contractLevel).toBe(7);
    expect(rows[0]?.closed.isAveragePm).toBe(true);
    expect(rows[0]?.closed.homeContract).toBeNull();
    expect(rows[0]?.closed.awayContract).toBeNull();
    expect(rows[0]?.closed.averageHome).toBe("minus"); // EW
    expect(rows[0]?.closed.averageAway).toBe("plus"); // NS
    expect(rows[0]?.closed.scoreHome).toBeNull();
  });
});

describe("pairNamesFromLineup", () => {
  it("formats NS and EW names per room", () => {
    const lineup: MatchLineupEntry[] = [
      {
        id: "1",
        team_id: "h",
        player_id: "p1",
        is_substitute: false,
        room: "open",
        direction: "N",
        player: { id: "p1", name: "Amsel Alon", member_number: null },
      },
      {
        id: "2",
        team_id: "h",
        player_id: "p2",
        is_substitute: false,
        room: "open",
        direction: "S",
        player: { id: "p2", name: "Bocken Patrick", member_number: null },
      },
      {
        id: "3",
        team_id: "a",
        player_id: "p3",
        is_substitute: false,
        room: "open",
        direction: "E",
        player: { id: "p3", name: "Labaere Valérie", member_number: null },
      },
      {
        id: "4",
        team_id: "a",
        player_id: "p4",
        is_substitute: false,
        room: "open",
        direction: "W",
        player: { id: "p4", name: "Labaere Alain", member_number: null },
      },
    ];
    expect(pairNamesFromLineup(lineup, "open")).toEqual({
      ns: "Amsel Alon & Bocken Patrick",
      ew: "Labaere Valérie & Labaere Alain",
    });
  });
});
