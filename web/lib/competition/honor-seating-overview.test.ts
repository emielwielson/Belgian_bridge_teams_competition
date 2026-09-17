import { describe, expect, it } from "vitest";
import {
  buildHonorVenueTableGrid,
  defaultHonorRound,
  honorLockStatus,
  honorRoundOptions,
  matchDayForHonorRound,
  roomForVenueTable,
  type HonorRoundMatchSeating,
} from "./honor-seating-overview";

describe("honorLockStatus", () => {
  it("derives waiting / side / both", () => {
    expect(honorLockStatus(false, false)).toBe("waiting");
    expect(honorLockStatus(false, true)).toBe("away_only");
    expect(honorLockStatus(true, false)).toBe("home_only");
    expect(honorLockStatus(true, true)).toBe("both");
  });
});

describe("honorRoundOptions", () => {
  it("maps 21 rounds to 7 days × 3 slots", () => {
    const options = honorRoundOptions(21);
    expect(options).toHaveLength(21);
    expect(options[0]).toEqual({
      round: 1,
      matchDay: 1,
      slotIndex: 0,
      slotTime: "11:00",
    });
    expect(options[2]).toEqual({
      round: 3,
      matchDay: 1,
      slotIndex: 2,
      slotTime: "16:40",
    });
    expect(options[20]).toEqual({
      round: 21,
      matchDay: 7,
      slotIndex: 2,
      slotTime: "16:40",
    });
  });
});

describe("matchDayForHonorRound", () => {
  it("groups consecutive slots into speeldagen", () => {
    expect(matchDayForHonorRound(1)).toBe(1);
    expect(matchDayForHonorRound(3)).toBe(1);
    expect(matchDayForHonorRound(4)).toBe(2);
    expect(matchDayForHonorRound(21)).toBe(7);
  });
});

describe("defaultHonorRound", () => {
  it("picks nearest upcoming round, else last", () => {
    const matches = [
      { round: 1, datetime: "2026-01-01T10:00:00Z" },
      { round: 2, datetime: "2026-01-01T12:50:00Z" },
      { round: 3, datetime: "2026-01-01T15:40:00Z" },
    ];
    expect(defaultHonorRound(matches, Date.parse("2026-01-01T11:00:00Z"))).toBe(
      2,
    );
    expect(defaultHonorRound(matches, Date.parse("2026-01-02T00:00:00Z"))).toBe(
      3,
    );
    expect(defaultHonorRound([], Date.now())).toBe(1);
  });
});

describe("roomForVenueTable", () => {
  it("odd open, even closed", () => {
    expect(roomForVenueTable(1)).toBe("open");
    expect(roomForVenueTable(2)).toBe("closed");
    expect(roomForVenueTable(7)).toBe("open");
  });
});

describe("buildHonorVenueTableGrid", () => {
  it("fills tables 1–8 from match venue tables and seats", () => {
    const match: HonorRoundMatchSeating = {
      match_id: "m1",
      round: 1,
      datetime: "2026-01-01T10:00:00Z",
      board_count: 16,
      phase: "sequential",
      home_team: { id: "h", name: "Home" },
      away_team: { id: "a", name: "Away" },
      home_slot: 1,
      away_slot: 8,
      home_lineup_locked_at: "2026-01-01T09:00:00Z",
      away_lineup_locked_at: null,
      lock_status: "home_only",
      home_seats_complete: true,
      away_seats_complete: false,
      venue_tables: { openTable: 1, closedTable: 2 },
      seats: [
        {
          player_id: "p1",
          name: "Alice",
          team_id: "h",
          room: "open",
          direction: "N",
          is_substitute: false,
        },
        {
          player_id: "p2",
          name: "Bob",
          team_id: "a",
          room: "open",
          direction: "E",
          is_substitute: false,
        },
      ],
    };

    const grid = buildHonorVenueTableGrid([match]);
    expect(grid).toHaveLength(8);
    expect(grid[0]?.table).toBe(1);
    expect(grid[0]?.room).toBe("open");
    expect(grid[0]?.seats.find((s) => s.direction === "N")?.name).toBe("Alice");
    expect(grid[0]?.seats.find((s) => s.direction === "N")?.side_locked).toBe(
      true,
    );
    expect(grid[0]?.seats.find((s) => s.direction === "E")?.side_locked).toBe(
      false,
    );
    expect(grid[1]?.table).toBe(2);
    expect(grid[1]?.room).toBe("closed");
    expect(grid[2]?.match_id).toBeNull();
  });
});
