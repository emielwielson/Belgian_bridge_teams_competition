import { describe, expect, it } from "vitest";
import type { BoardHands } from "@/lib/boards/types";
import {
  boardHandsToHandRecordRow,
  honorBoardsToHandRecords,
} from "./hand-record";

const sampleHands: BoardHands = {
  N: { S: "AK2", H: "QJ3", D: "T98", C: "7654" },
  E: { S: "QJ3", H: "AK2", D: "7654", C: "T98" },
  S: { S: "T98", H: "7654", D: "AK2", C: "QJ3" },
  W: { S: "7654", H: "T98", D: "QJ3", C: "AK2" },
};

describe("boardHandsToHandRecordRow", () => {
  it("maps seats and suits to Bridgemate HandRecord columns", () => {
    expect(boardHandsToHandRecordRow(1, 17, sampleHands)).toEqual({
      Section: 1,
      Board: 17,
      NorthSpades: "AK2",
      NorthHearts: "QJ3",
      NorthDiamonds: "T98",
      NorthClubs: "7654",
      EastSpades: "QJ3",
      EastHearts: "AK2",
      EastDiamonds: "7654",
      EastClubs: "T98",
      SouthSpades: "T98",
      SouthHearts: "7654",
      SouthDiamonds: "AK2",
      SouthClubs: "QJ3",
      WestSpades: "7654",
      WestHearts: "T98",
      WestDiamonds: "QJ3",
      WestClubs: "AK2",
    });
  });
});

describe("honorBoardsToHandRecords", () => {
  it("sorts by board number and uses section id", () => {
    const rows = honorBoardsToHandRecords(
      [
        { board_number: 2, hands: sampleHands },
        { board_number: 1, hands: sampleHands },
      ],
      1,
    );
    expect(rows.map((r) => r.Board)).toEqual([1, 2]);
    expect(rows[0].Section).toBe(1);
    expect(rows[0].NorthSpades).toBe("AK2");
  });
});
