/**
 * Bridgemate ReceivedData row shape (BMdevguide).
 * Field names match Access columns; values may arrive as string/number/boolean.
 */
export type ReceivedDataRow = {
  Section?: string | number | null;
  Table?: string | number | null;
  Round?: string | number | null;
  Board?: string | number | null;
  PairNS?: string | number | null;
  PairEW?: string | number | null;
  Declarer?: string | number | null;
  /** Direction string "N"/"E"/"S"/"W" or NS/EW indicator */
  "NS/EW"?: string | number | null;
  NSEW?: string | number | null;
  Contract?: string | number | null;
  Result?: string | number | null;
  LeadCard?: string | number | null;
  Remarks?: string | number | null;
  DateLog?: string | number | Date | null;
  TimeLog?: string | number | Date | null;
  Erased?: boolean | number | string | null;
  SuspiciousContract?: boolean | number | string | null;
  ScoreNS?: string | number | null;
  ScoreEW?: string | number | null;
  /** Some exports use lowercase keys */
  [key: string]: unknown;
};

export type BridgemateMappingContext = {
  /** Absolute tournament round number (1..N) — authoritative for this upload */
  tournamentRoundNumber: number;
  /**
   * Optional BCS session round in ReceivedData. Do not set this to the
   * tournament round: generated .bws files use Round=1 for every session.
   */
  expectedBridgemateRound?: number | null;
  tables: Array<{
    id: string;
    matchId: string;
    bridgemateSection: string | null;
    bridgemateTable: number | null;
    nsPairId: string | null;
    ewPairId: string | null;
  }>;
  pairs: Array<{
    id: string;
    bridgematePairNumber: number | null;
  }>;
  boards: Array<{
    id: string;
    boardNumber: number;
  }>;
};

export type MappedRowIds = {
  matchId: string;
  tableId: string;
  boardId: string;
  nsPairId: string | null;
  ewPairId: string | null;
};

export type MapRowResult =
  | { ok: true; mapped: MappedRowIds }
  | { ok: false; errors: string[] };
