export type Dealer = "N" | "E" | "S" | "W";
export type Vulnerability = "NONE" | "NS" | "EW" | "BOTH";

/** Suit holding as rank characters, e.g. "AKQJT" (high to low, no suit prefix). */
export type SuitHolding = string;

export type Hand = {
  S: SuitHolding;
  H: SuitHolding;
  D: SuitHolding;
  C: SuitHolding;
};

export type BoardHands = {
  N: Hand;
  E: Hand;
  S: Hand;
  W: Hand;
};

export type ParsedBoard = {
  boardNumber: number;
  dealer: Dealer;
  vulnerability: Vulnerability;
  hands: BoardHands;
};

export type BoardValidationError = {
  boardNumber: number | null;
  message: string;
};

export type ContractDenomination =
  | "CLUBS"
  | "DIAMONDS"
  | "HEARTS"
  | "SPADES"
  | "NT"
  | "PASS";

export type Doubling = "NONE" | "DOUBLED" | "REDOUBLED";
export type Declarer = "N" | "E" | "S" | "W";
export type SpecialResultKind =
  | "NONE"
  | "NOT_PLAYED"
  | "ARBITRAL"
  | "ADJUSTED"
  | "ERASED";
