import { describe, expect, it } from "vitest";
import {
  emptyScheduleSlots,
  slotsAreComplete,
  usesRbbfTemplate,
  validateSlotPayload,
} from "./group-schedule-slots";

const teamIds = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];

function fullEightTeamSlots() {
  return emptyScheduleSlots().map((s, i) => ({
    slot: s.slot,
    teamId: teamIds[i],
    isBye: false,
  }));
}

function sevenTeamSlotsWithBye(byeSlot = 8) {
  let teamIdx = 0;
  return emptyScheduleSlots().map((s) => {
    if (s.slot === byeSlot) {
      return { slot: s.slot, teamId: null, isBye: true };
    }
    return { slot: s.slot, teamId: teamIds[teamIdx++], isBye: false };
  });
}

describe("group-schedule-slots", () => {
  it("usesRbbfTemplate for national 8 teams with filled slots", () => {
    const slots = emptyScheduleSlots().map((s, i) => ({
      ...s,
      teamId: teamIds[i],
    }));
    expect(usesRbbfTemplate("national", 8, slots)).toBe(true);
  });

  it("usesRbbfTemplate for national 7 teams with bye", () => {
    const slots = sevenTeamSlotsWithBye(3).map((s) => ({
      slot: s.slot,
      teamId: s.teamId,
      isBye: s.isBye,
    }));
    expect(usesRbbfTemplate("national", 7, slots)).toBe(true);
  });

  it("usesRbbfTemplate for regional 8 without requiring slot rows", () => {
    expect(usesRbbfTemplate("regional", 8, emptyScheduleSlots())).toBe(true);
  });

  it("slotsAreComplete requires one bye for 7 teams", () => {
    const incomplete = emptyScheduleSlots().map((s, i) =>
      i < 7 ? { ...s, teamId: teamIds[i] } : s,
    );
    expect(slotsAreComplete(7, incomplete)).toBe(false);

    const complete = sevenTeamSlotsWithBye().map((s) => ({
      slot: s.slot,
      teamId: s.teamId,
      isBye: s.isBye,
    }));
    expect(slotsAreComplete(7, complete)).toBe(true);
  });

  it("validateSlotPayload rejects duplicate teams", () => {
    const slots = fullEightTeamSlots();
    slots[1] = { slot: 2, teamId: teamIds[0], isBye: false };
    expect(validateSlotPayload(8, teamIds, slots)).toMatch(/one slot/i);
  });

  it("validateSlotPayload requires complete assignment when flagged", () => {
    const partial = emptyScheduleSlots().map((s, i) =>
      i < 4 ? { slot: s.slot, teamId: teamIds[i], isBye: false } : { slot: s.slot, teamId: null, isBye: false },
    );
    expect(
      validateSlotPayload(8, teamIds, partial, { requireComplete: true }),
    ).toMatch(/8 teams/i);
  });

  it("validateSlotPayload allows partial saves by default", () => {
    const partial = emptyScheduleSlots().map((s, i) =>
      i < 4 ? { slot: s.slot, teamId: teamIds[i], isBye: false } : { slot: s.slot, teamId: null, isBye: false },
    );
    expect(validateSlotPayload(8, teamIds, partial)).toBeNull();
  });
});
