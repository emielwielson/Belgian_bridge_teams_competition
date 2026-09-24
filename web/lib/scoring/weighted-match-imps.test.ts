import { describe, expect, it } from "vitest";
import {
  favorTeamFromRoomNop,
  resolveFavorTeam,
  roundImpsFavoring,
  weightedMatchImpsFromLegs,
} from "./weighted-match-imps";
import {
  computeHonorMatchImps,
  groupHonorMatchBoardPairs,
} from "./honor-match-imps";
import { pointsToImps } from "./wbf-imp-table";
import { buildScorecardBoardRows } from "@/lib/competition/honor-match-scorecard";

describe("roundImpsFavoring", () => {
  it("rounds .5 toward home gain", () => {
    expect(roundImpsFavoring(4.5, "home")).toBe(5);
    expect(roundImpsFavoring(-4.5, "home")).toBe(-4);
  });

  it("rounds .5 toward away gain", () => {
    expect(roundImpsFavoring(4.5, "away")).toBe(4);
    expect(roundImpsFavoring(-4.5, "away")).toBe(-5);
  });

  it("uses half away from zero when no favor", () => {
    expect(roundImpsFavoring(4.5, null)).toBe(5);
    expect(roundImpsFavoring(-4.5, null)).toBe(-5);
  });

  it("rounds non-half fractions mathematically", () => {
    expect(roundImpsFavoring(4.3, "away")).toBe(4);
    expect(roundImpsFavoring(4.7, "away")).toBe(5);
    expect(roundImpsFavoring(-4.3, "home")).toBe(-4);
  });
});

describe("favorTeamFromRoomNop / resolveFavorTeam", () => {
  it("maps open/closed NS/EW to home/away", () => {
    expect(favorTeamFromRoomNop("open", "ns")).toBe("home");
    expect(favorTeamFromRoomNop("open", "ew")).toBe("away");
    expect(favorTeamFromRoomNop("closed", "ns")).toBe("away");
    expect(favorTeamFromRoomNop("closed", "ew")).toBe("home");
  });

  it("agrees when both rooms favor the same team", () => {
    expect(
      resolveFavorTeam({
        openNop: "ns",
        closedNop: "ew",
        openWeighted: true,
        closedWeighted: true,
      }),
    ).toBe("home");
  });

  it("returns null when NOPs disagree", () => {
    expect(
      resolveFavorTeam({
        openNop: "ns",
        closedNop: "ns",
        openWeighted: true,
        closedWeighted: true,
      }),
    ).toBeNull();
  });
});

describe("weightedMatchImpsFromLegs", () => {
  it("treats a single score as a normal board vs the other room", () => {
    const result = weightedMatchImpsFromLegs({
      open: {
        legs: [{ score: 450, weightNs: 1, weightEw: 1 }],
        nonOffendingSide: "ns",
      },
      closed: { nsScore: 420 },
    });
    // 450-420=30 → 1 IMP
    expect(result).toMatchObject({
      net: 1,
      roundedNet: 1,
      homeImps: 1,
      awayImps: 0,
    });
  });

  it("weights IMPs not table points (classic 4.5 case)", () => {
    // Other room +420; this room 50/50 on +450 / −50
    // Point average would be +200 → diff 220 → 6 IMPs (wrong)
    // IMP path: IMP(450−420)=1, IMP(−50−420)=−10 → mean −4.5
    // Wait: open is weighted room with legs, closed is fixed 420
    // openNs - closedNs: 450-420=30 → 1 IMP; -50-420=-470 → -10 IMP
    // mean = 0.5*1 + 0.5*(-10) = -4.5
    // With NOP home (open ns): -4.5 → -4 → away gets 4
    // With NOP away (open ew): -4.5 → -5 → away gets 5

    const legs = [
      { score: 450, weightNs: 1, weightEw: 1 },
      { score: -50, weightNs: 1, weightEw: 1 },
    ];

    const homeFavor = weightedMatchImpsFromLegs({
      open: { legs, nonOffendingSide: "ns" },
      closed: { nsScore: 420 },
    });
    expect(homeFavor.net).toBe(-4.5);
    expect(homeFavor.roundedNet).toBe(-4);
    expect(homeFavor).toMatchObject({ homeImps: 0, awayImps: 4 });

    const awayFavor = weightedMatchImpsFromLegs({
      open: { legs, nonOffendingSide: "ew" },
      closed: { nsScore: 420 },
    });
    expect(awayFavor.roundedNet).toBe(-5);
    expect(awayFavor).toMatchObject({ homeImps: 0, awayImps: 5 });

    // Confirms point-weighting would differ
    const pointAvg = (450 + -50) / 2;
    expect(pointsToImps(pointAvg - 420)).toBe(-6);
  });

  it("positive 4.5 rounds by NOP", () => {
    // Closed weighted vs open fixed: want +4.5 home
    // open 420, closed legs that give IMPs of +1 and +8? 
    // Actually: openNs - closedNs positive when open > closed
    // 50/50: IMP(420 - X) and IMP(420 - Y) average 4.5
    // Use open weighted with high scores vs closed low
    // open legs 450 and 890 vs closed 400:
    // 450-400=50 → 2; 890-400=490 → 10; mean 6 — not 4.5
    // open 450 / -50 vs closed 0: 450→10, -50→-2; mean 4
    // open 620 / 50 vs closed 100: 520→11, -50→-2; mean 4.5
    const resultHome = weightedMatchImpsFromLegs({
      open: {
        legs: [
          { score: 620, weightNs: 1, weightEw: 1 },
          { score: 50, weightNs: 1, weightEw: 1 },
        ],
        nonOffendingSide: "ns",
      },
      closed: { nsScore: 100 },
    });
    // 620-100=520 → 11; 50-100=-50 → -2; mean 4.5
    expect(resultHome.net).toBe(4.5);
    expect(resultHome.roundedNet).toBe(5);
    expect(resultHome).toMatchObject({ homeImps: 5, awayImps: 0 });

    const resultAway = weightedMatchImpsFromLegs({
      open: {
        legs: [
          { score: 620, weightNs: 1, weightEw: 1 },
          { score: 50, weightNs: 1, weightEw: 1 },
        ],
        nonOffendingSide: "ew",
      },
      closed: { nsScore: 100 },
    });
    expect(resultAway.roundedNet).toBe(4);
    expect(resultAway).toMatchObject({ homeImps: 4, awayImps: 0 });
  });

  it("products weights when both rooms are weighted", () => {
    const result = weightedMatchImpsFromLegs({
      open: {
        legs: [
          { score: 100, weightNs: 1, weightEw: 1 },
          { score: 200, weightNs: 1, weightEw: 1 },
        ],
        nonOffendingSide: "ns",
      },
      closed: {
        legs: [
          { score: 100, weightNs: 1, weightEw: 1 },
          { score: 0, weightNs: 1, weightEw: 1 },
        ],
        nonOffendingSide: "ew", // both map to home
      },
    });
    // Pairs: (100-100)=0→0, (100-0)=100→3, (200-100)=100→3, (200-0)=200→5
    // mean = (0+3+3+5)/4 = 2.75 → 3
    expect(result.net).toBe(2.75);
    expect(result.roundedNet).toBe(3);
    expect(result).toMatchObject({ homeImps: 3, awayImps: 0 });
  });
});

describe("groupHonorMatchBoardPairs weighted", () => {
  it("uses IMP-weighted assigned IMPs", () => {
    const pairs = groupHonorMatchBoardPairs(
      [
        {
          match_id: "m1",
          room: "open",
          board_id: "b1",
          ns_score: null,
          computed_score: null,
          admin_adjusted_ns_score: 200,
          included_in_match_score: true,
          adjustment_mode: "weighted",
          adjustment_meta: {
            legs: [
              { score: 620, weightNs: 1, weightEw: 1 },
              { score: 50, weightNs: 1, weightEw: 1 },
            ],
            nonOffendingSide: "ns",
          },
        },
        {
          match_id: "m1",
          room: "closed",
          board_id: "b1",
          ns_score: 100,
          computed_score: 100,
          admin_adjusted_ns_score: null,
          included_in_match_score: true,
        },
      ],
      "m1",
    );
    expect(pairs).toEqual([{ kind: "assigned", homeImps: 5, awayImps: 0 }]);
    expect(computeHonorMatchImps(pairs as never)).toEqual({
      impsHome: 5,
      impsAway: 0,
    });
  });

  it("honors match IMP override", () => {
    const pairs = groupHonorMatchBoardPairs(
      [
        {
          match_id: "m1",
          room: "open",
          board_id: "b1",
          ns_score: null,
          computed_score: null,
          admin_adjusted_ns_score: 200,
          included_in_match_score: true,
          adjustment_mode: "weighted",
          adjustment_meta: {
            legs: [
              { score: 620, weightNs: 1, weightEw: 1 },
              { score: 50, weightNs: 1, weightEw: 1 },
            ],
            nonOffendingSide: "ns",
            matchImpsOverride: { homeImps: 2, awayImps: 1 },
          },
        },
        {
          match_id: "m1",
          room: "closed",
          board_id: "b1",
          ns_score: 100,
          computed_score: 100,
          admin_adjusted_ns_score: null,
          included_in_match_score: true,
        },
      ],
      "m1",
    );
    expect(pairs).toEqual([{ kind: "assigned", homeImps: 2, awayImps: 1 }]);
  });
});

describe("scorecard weighted boards", () => {
  it("shows assigned IMPs for weighted boards", () => {
    const boards = buildScorecardBoardRows([
      {
        boardId: "b1",
        boardNumber: 1,
        dealer: null,
        vulnerability: null,
        room: "open",
        contractLevel: null,
        contractDenomination: null,
        doubling: "NONE",
        declarer: null,
        tricksResult: null,
        nsScore: null,
        computedScore: null,
        adminAdjustedNsScore: 335,
        includedInMatchScore: true,
        adjustmentMode: "weighted",
        adjustmentMeta: {
          legs: [
            { score: 620, weightNs: 1, weightEw: 1 },
            { score: 50, weightNs: 1, weightEw: 1 },
          ],
          nonOffendingSide: "ns",
        },
      },
      {
        boardId: "b1",
        boardNumber: 1,
        dealer: null,
        vulnerability: null,
        room: "closed",
        contractLevel: null,
        contractDenomination: null,
        doubling: "NONE",
        declarer: null,
        tricksResult: null,
        nsScore: 100,
        computedScore: 100,
        adminAdjustedNsScore: null,
        includedInMatchScore: true,
        adjustmentMode: null,
        adjustmentMeta: null,
      },
    ]);
    expect(boards).toHaveLength(1);
    expect(boards[0]).toMatchObject({
      kind: "assigned",
      impsHome: 5,
      impsAway: 0,
      deltaMp: null,
    });
  });
});
