import type { BoardHands } from "@/lib/boards/types";

/** Bridgemate HandRecord row (suit holdings as rank letters 2-9TJQKA). */
export type BwsHandRecordInsert = {
  Section: number;
  Board: number;
  NorthSpades: string;
  NorthHearts: string;
  NorthDiamonds: string;
  NorthClubs: string;
  EastSpades: string;
  EastHearts: string;
  EastDiamonds: string;
  EastClubs: string;
  SouthSpades: string;
  SouthHearts: string;
  SouthDiamonds: string;
  SouthClubs: string;
  WestSpades: string;
  WestHearts: string;
  WestDiamonds: string;
  WestClubs: string;
};

export type HonorBoardForHandRecord = {
  board_number: number;
  hands: BoardHands;
};

/** Map DB/PBN board hands to a Bridgemate HandRecord row. */
export function boardHandsToHandRecordRow(
  sectionId: number,
  boardNumber: number,
  hands: BoardHands,
): BwsHandRecordInsert {
  return {
    Section: sectionId,
    Board: boardNumber,
    NorthSpades: hands.N.S,
    NorthHearts: hands.N.H,
    NorthDiamonds: hands.N.D,
    NorthClubs: hands.N.C,
    EastSpades: hands.E.S,
    EastHearts: hands.E.H,
    EastDiamonds: hands.E.D,
    EastClubs: hands.E.C,
    SouthSpades: hands.S.S,
    SouthHearts: hands.S.H,
    SouthDiamonds: hands.S.D,
    SouthClubs: hands.S.C,
    WestSpades: hands.W.S,
    WestHearts: hands.W.H,
    WestDiamonds: hands.W.D,
    WestClubs: hands.W.C,
  };
}

export function honorBoardsToHandRecords(
  boards: HonorBoardForHandRecord[],
  sectionId = 1,
): BwsHandRecordInsert[] {
  return [...boards]
    .sort((a, b) => a.board_number - b.board_number)
    .map((b) =>
      boardHandsToHandRecordRow(sectionId, b.board_number, b.hands),
    );
}
