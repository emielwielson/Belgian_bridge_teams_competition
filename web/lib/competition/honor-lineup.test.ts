import { describe, expect, it } from "vitest";
import {
  canEditHonorSide,
  canLockHonorSide,
  canViewOpponentLineup,
  honorLineupPhase,
  honorSeatSlots,
  isAllowedHonorSeat,
  isHonorSeatedLineupComplete,
  roundsPerRoundRobin,
  venueTablesForHonorMatch,
} from "./honor-lineup";

describe("honorSeatSlots", () => {
  it("gives home Open N/S and Closed E/W", () => {
    expect(honorSeatSlots("home")).toEqual([
      { room: "open", direction: "N" },
      { room: "open", direction: "S" },
      { room: "closed", direction: "E" },
      { room: "closed", direction: "W" },
    ]);
  });

  it("gives away Open E/W and Closed N/S", () => {
    expect(honorSeatSlots("away")).toEqual([
      { room: "open", direction: "E" },
      { room: "open", direction: "W" },
      { room: "closed", direction: "N" },
      { room: "closed", direction: "S" },
    ]);
  });
});

describe("isAllowedHonorSeat", () => {
  it("rejects home sitting Open E", () => {
    expect(isAllowedHonorSeat("home", "open", "E")).toBe(false);
  });

  it("allows away Open E", () => {
    expect(isAllowedHonorSeat("away", "open", "E")).toBe(true);
  });
});

describe("honorLineupPhase", () => {
  it("is sequential for RR1 and RR2", () => {
    expect(honorLineupPhase(1, 7)).toBe("sequential");
    expect(honorLineupPhase(14, 7)).toBe("sequential");
  });

  it("is blind for RR3", () => {
    expect(honorLineupPhase(15, 7)).toBe("blind");
    expect(honorLineupPhase(21, 7)).toBe("blind");
  });
});

describe("roundsPerRoundRobin", () => {
  it("uses 7 for Honor 21/3", () => {
    expect(roundsPerRoundRobin(21, 3)).toBe(7);
  });
});

describe("canEditHonorSide / canViewOpponentLineup / canLockHonorSide", () => {
  it("sequential: home cannot edit before away locks", () => {
    expect(
      canEditHonorSide({
        side: "home",
        phase: "sequential",
        homeLocked: false,
        awayLocked: false,
        isManager: false,
        played: false,
      }),
    ).toBe(false);
    expect(
      canEditHonorSide({
        side: "away",
        phase: "sequential",
        homeLocked: false,
        awayLocked: false,
        isManager: false,
        played: false,
      }),
    ).toBe(true);
  });

  it("sequential: home sees away after away locks", () => {
    expect(
      canViewOpponentLineup({
        viewerSide: "home",
        phase: "sequential",
        homeLocked: false,
        awayLocked: true,
      }),
    ).toBe(true);
    expect(
      canViewOpponentLineup({
        viewerSide: "away",
        phase: "sequential",
        homeLocked: false,
        awayLocked: true,
      }),
    ).toBe(false);
  });

  it("blind: neither sees until both locked", () => {
    expect(
      canViewOpponentLineup({
        viewerSide: "home",
        phase: "blind",
        homeLocked: true,
        awayLocked: false,
      }),
    ).toBe(false);
    expect(
      canViewOpponentLineup({
        viewerSide: "away",
        phase: "blind",
        homeLocked: true,
        awayLocked: true,
      }),
    ).toBe(true);
  });

  it("sequential: home cannot lock before away", () => {
    expect(
      canLockHonorSide({
        side: "home",
        phase: "sequential",
        homeLocked: false,
        awayLocked: false,
        isManager: false,
        played: false,
        seatsComplete: true,
      }),
    ).toBe(false);
  });

  it("managers bypass sequencing for edit when unlocked", () => {
    expect(
      canEditHonorSide({
        side: "home",
        phase: "sequential",
        homeLocked: false,
        awayLocked: false,
        isManager: true,
        played: false,
      }),
    ).toBe(true);
  });

  it("managers cannot edit a locked side without unlocking", () => {
    expect(
      canEditHonorSide({
        side: "away",
        phase: "sequential",
        homeLocked: false,
        awayLocked: true,
        isManager: true,
        played: false,
      }),
    ).toBe(false);
  });
});

describe("isHonorSeatedLineupComplete", () => {
  it("requires all four home seats", () => {
    expect(
      isHonorSeatedLineupComplete(
        [
          { player_id: "a", room: "open", direction: "N" },
          { player_id: "b", room: "open", direction: "S" },
          { player_id: "c", room: "closed", direction: "E" },
        ],
        "home",
      ),
    ).toBe(false);

    expect(
      isHonorSeatedLineupComplete(
        [
          { player_id: "a", room: "open", direction: "N" },
          { player_id: "b", room: "open", direction: "S" },
          { player_id: "c", room: "closed", direction: "E" },
          { player_id: "d", room: "closed", direction: "W" },
        ],
        "home",
      ),
    ).toBe(true);
  });
});

describe("venueTablesForHonorMatch", () => {
  it("maps first RBBF pairing of round 1 to tables 1–2", () => {
    expect(
      venueTablesForHonorMatch({
        round: 1,
        roundCount: 21,
        homeSlot: 1,
        awaySlot: 2,
      }),
    ).toEqual({ openTable: 1, closedTable: 2 });
  });

  it("maps second pairing to tables 3–4", () => {
    expect(
      venueTablesForHonorMatch({
        round: 1,
        roundCount: 21,
        homeSlot: 3,
        awaySlot: 4,
      }),
    ).toEqual({ openTable: 3, closedTable: 4 });
  });
});
