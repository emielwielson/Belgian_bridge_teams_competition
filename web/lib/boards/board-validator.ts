import type { Dealer, Vulnerability } from "@/lib/boards/types";
import type {
  BoardHands,
  BoardValidationError,
  Hand,
  ParsedBoard,
} from "@/lib/boards/types";

const RANKS = new Set(["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"]);
const SUITS = ["S", "H", "D", "C"] as const;
const SEATS: (keyof BoardHands)[] = ["N", "E", "S", "W"];

function cardLabel(suit: string, rank: string): string {
  return `${suit}${rank}`;
}

function expandHand(hand: Hand): string[] {
  const cards: string[] = [];
  for (const suit of SUITS) {
    const holding = hand[suit];
    for (const ch of holding) {
      cards.push(cardLabel(suit, ch));
    }
  }
  return cards;
}

function countCardsInHand(hand: Hand): number {
  return (
    hand.S.length + hand.H.length + hand.D.length + hand.C.length
  );
}

function validateRanksInHand(
  boardNumber: number,
  seat: string,
  hand: Hand,
): BoardValidationError[] {
  const errors: BoardValidationError[] = [];
  for (const suit of SUITS) {
    for (const ch of hand[suit]) {
      if (!RANKS.has(ch)) {
        errors.push({
          boardNumber,
          message: `Bord ${boardNumber}: Ongeldige kaart '${ch}' in ${seat} (${suit}).`,
        });
      }
    }
  }
  return errors;
}

export function validateBoardHands(
  boardNumber: number,
  hands: BoardHands,
): BoardValidationError[] {
  const errors: BoardValidationError[] = [];
  const allCards: string[] = [];

  for (const seat of SEATS) {
    const hand = hands[seat];
    errors.push(...validateRanksInHand(boardNumber, seat, hand));
    const n = countCardsInHand(hand);
    if (n !== 13) {
      errors.push({
        boardNumber,
        message: `Bord ${boardNumber}: Hand ${seat} heeft ${n} kaarten (verwacht 13).`,
      });
    }
    allCards.push(...expandHand(hand));
  }

  const seen = new Map<string, number>();
  for (const c of allCards) {
    seen.set(c, (seen.get(c) ?? 0) + 1);
  }
  for (const [card, count] of seen) {
    if (count > 1) {
      errors.push({
        boardNumber,
        message: `Bord ${boardNumber}: Kaart ${card} komt twee keer voor.`,
      });
    }
  }

  if (allCards.length === 52 && seen.size < 52) {
    // duplicates already reported
  } else if (allCards.length === 52) {
    // check missing — if unique count is 52 we're fine
  }

  // If we have wrong total unique cards but no duplicate messages yet, note incompleteness
  const unique = [...seen.keys()].filter((c) => (seen.get(c) ?? 0) === 1);
  if (allCards.length !== 52 && errors.length === 0) {
    errors.push({
      boardNumber,
      message: `Bord ${boardNumber}: Verwacht 52 kaarten, gevonden ${allCards.length}.`,
    });
  }

  // Suppress unused — unique used for clarity in incomplete decks with dups
  void unique;

  return errors;
}

export function validateDealer(dealer: Dealer | null | undefined, boardNumber: number): BoardValidationError[] {
  if (!dealer || !["N", "E", "S", "W"].includes(dealer)) {
    return [
      {
        boardNumber,
        message: `Bord ${boardNumber}: Ongeldige dealer.`,
      },
    ];
  }
  return [];
}

export function validateVulnerability(
  vulnerability: Vulnerability | null | undefined,
  boardNumber: number,
): BoardValidationError[] {
  if (
    !vulnerability ||
    !["NONE", "NS", "EW", "BOTH"].includes(vulnerability)
  ) {
    return [
      {
        boardNumber,
        message: `Bord ${boardNumber}: Ongeldige kwetsbaarheid.`,
      },
    ];
  }
  return [];
}

export function validateBoardNumber(boardNumber: number): BoardValidationError[] {
  if (!Number.isInteger(boardNumber) || boardNumber < 1) {
    return [
      {
        boardNumber: null,
        message: `Ongeldig bordnummer: ${boardNumber}.`,
      },
    ];
  }
  return [];
}

/** Full board validation (PRD §4.4). */
export function validateBoard(board: ParsedBoard): BoardValidationError[] {
  return [
    ...validateBoardNumber(board.boardNumber),
    ...validateDealer(board.dealer, board.boardNumber),
    ...validateVulnerability(board.vulnerability, board.boardNumber),
    ...validateBoardHands(board.boardNumber, board.hands),
  ];
}

export function validateBoards(boards: ParsedBoard[]): BoardValidationError[] {
  const errors: BoardValidationError[] = [];
  const seenNumbers = new Set<number>();
  for (const board of boards) {
    if (seenNumbers.has(board.boardNumber)) {
      errors.push({
        boardNumber: board.boardNumber,
        message: `Bord ${board.boardNumber}: Bordnummer komt dubbel voor in het bestand.`,
      });
    }
    seenNumbers.add(board.boardNumber);
    errors.push(...validateBoard(board));
  }
  return errors;
}
