export type BwsSessionTableInput = {
  id: string;
  bridgemateSection: string | null;
  bridgemateTable: number | null;
  nsPairId: string | null;
  ewPairId: string | null;
};

export type BwsBoardRange = {
  lowBoard: number;
  highBoard: number;
};

export type BwsSessionMatchInput = {
  id: string;
  boardCount: number;
  tables: BwsSessionTableInput[];
};

export type BwsSessionPairInput = {
  id: string;
  bridgematePairNumber: number | null;
};

export type BwsSessionInput = {
  tournamentRoundNumber: number;
  sessionName?: string;
  /** From imported PBN board numbers; defaults to 1..boardCount per match. */
  boardRange?: BwsBoardRange;
  matches: BwsSessionMatchInput[];
  pairs: BwsSessionPairInput[];
};

export type BwsSectionRow = {
  id: number;
  letter: string;
  tables: number;
  missingPair: number;
  ewMoveBeforePlay: number;
  session: number;
  scoringType: number;
  winners: number;
};

export type BwsTableRow = {
  section: number;
  table: number;
  computerId: number;
  status: number;
  logOnOff: number;
  currentRound: number;
  currentBoard: number;
  updateFromRound: number;
  group: number;
};

export type BwsRoundDataRow = {
  section: number;
  table: number;
  round: number;
  nsPair: number;
  ewPair: number;
  lowBoard: number;
  highBoard: number;
  customBoards: string | null;
};

export type BwsSessionRow = {
  id: number;
  name: string;
  guid: string;
  status: number;
  showInApp: boolean;
  pairsMoveAcrossField: boolean;
  ewReturnHome: boolean;
};

/** Pre-registered Bridgemate II/III seat name (PlayerNumbers). */
export type BwsPlayerNumberRow = {
  section: number;
  table: number;
  direction: "N" | "S" | "E" | "W";
  number: string | null;
  name: string;
  updated: boolean;
  processed: boolean;
  round: number;
};

/**
 * BCS Settings row. Values match Bridgemate defaults except name-display fields
 * (BM2NameSource=2, BM2ShowPlayerNames=1, MemberNumbers=false).
 */
export type BwsSettingsRow = Record<string, string | number | boolean>;

export type BwsSessionPlan = {
  session: BwsSessionRow;
  sections: BwsSectionRow[];
  tables: BwsTableRow[];
  roundData: BwsRoundDataRow[];
  playerNumbers: BwsPlayerNumberRow[];
  settings: BwsSettingsRow[];
  filename: string;
};

export type BwsSessionResult =
  | { ok: true; plan: BwsSessionPlan }
  | { ok: false; errors: string[] };

const BCS_ROUND = 1;
const SESSION_ID = 1;
const SCORING_TYPE_TEAMS = 4;
const WINNERS_TWO = 2;
const MAX_SESSION_NAME = 40;

function sectionKey(section: string): string {
  return section.trim().toUpperCase();
}

function pairNumber(
  pairId: string,
  pairsById: Map<string, BwsSessionPairInput>,
): number | null {
  const pair = pairsById.get(pairId);
  if (!pair) return null;
  return pair.bridgematePairNumber;
}

function minTableNumber(match: BwsSessionMatchInput): number {
  const nums = match.tables
    .map((t) => t.bridgemateTable)
    .filter((n): n is number => n != null);
  return nums.length ? Math.min(...nums) : Number.POSITIVE_INFINITY;
}

/** Build BCS session rows from an Honor Division round schedule. */
export function buildBwsSession(
  input: BwsSessionInput,
  options?: { guid?: string },
): BwsSessionResult {
  const errors: string[] = [];
  const pairsById = new Map(input.pairs.map((p) => [p.id, p]));
  const seen = new Set<string>();

  if (!input.matches.length) {
    errors.push("Deze ronde heeft geen wedstrijden.");
  }

  const matches = [...input.matches].sort((a, b) => {
    const d = minTableNumber(a) - minTableNumber(b);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });

  type Pending = {
    sectionLetter: string;
    table: number;
    group: number;
    nsPair: number;
    ewPair: number;
    boardCount: number;
  };
  const pending: Pending[] = [];

  matches.forEach((match, matchIndex) => {
    if (!match.tables.length) {
      errors.push(`Wedstrijd ${match.id} heeft geen tafels.`);
      return;
    }
    const group = matchIndex + 1;
    const boardCount = match.boardCount;
    if (!Number.isInteger(boardCount) || boardCount < 1) {
      errors.push(`Wedstrijd ${match.id} heeft een ongeldig aantal spellen.`);
    }

    for (const table of match.tables) {
      const letter = table.bridgemateSection?.trim()
        ? sectionKey(table.bridgemateSection)
        : null;
      if (!letter) {
        errors.push(
          `Tafel ${table.id}: Bridgemate-sectie ontbreekt. Vul de sectie in het schema in.`,
        );
      }
      if (table.bridgemateTable == null) {
        errors.push(
          `Tafel ${table.id}: Bridgemate-tafelnummer ontbreekt. Vul het tafelnummer in het schema in.`,
        );
      }
      if (!table.nsPairId) {
        errors.push(`Tafel ${table.id}: NS-paar ontbreekt.`);
      }
      if (!table.ewPairId) {
        errors.push(`Tafel ${table.id}: OW-paar ontbreekt.`);
      }

      const ns =
        table.nsPairId != null
          ? pairNumber(table.nsPairId, pairsById)
          : null;
      const ew =
        table.ewPairId != null
          ? pairNumber(table.ewPairId, pairsById)
          : null;
      if (table.nsPairId && ns == null) {
        errors.push(
          `NS-paar is niet gekoppeld aan een Bridgemate-paarnummer.`,
        );
      }
      if (table.ewPairId && ew == null) {
        errors.push(
          `OW-paar is niet gekoppeld aan een Bridgemate-paarnummer.`,
        );
      }

      if (letter && table.bridgemateTable != null) {
        const key = `${letter}:${table.bridgemateTable}`;
        if (seen.has(key)) {
          errors.push(
            `Dubbele Bridgemate-tafel ${letter}${table.bridgemateTable}.`,
          );
        }
        seen.add(key);
      }

      if (
        letter &&
        table.bridgemateTable != null &&
        ns != null &&
        ew != null &&
        Number.isInteger(boardCount) &&
        boardCount >= 1
      ) {
        pending.push({
          sectionLetter: letter,
          table: table.bridgemateTable,
          group,
          nsPair: ns,
          ewPair: ew,
          boardCount,
        });
      }
    }
  });

  if (errors.length) return { ok: false, errors };

  const letters = [...new Set(pending.map((p) => p.sectionLetter))].sort();
  const sectionIdByLetter = new Map(
    letters.map((letter, i) => [letter, i + 1] as const),
  );

  const sections: BwsSectionRow[] = letters.map((letter) => ({
    id: sectionIdByLetter.get(letter)!,
    letter,
    tables: pending.filter((p) => p.sectionLetter === letter).length,
    missingPair: 0,
    ewMoveBeforePlay: 0,
    session: SESSION_ID,
    scoringType: SCORING_TYPE_TEAMS,
    winners: WINNERS_TWO,
  }));

  const tables: BwsTableRow[] = pending.map((p) => ({
    section: sectionIdByLetter.get(p.sectionLetter)!,
    table: p.table,
    computerId: 0,
    status: 0,
    logOnOff: 2,
    currentRound: 0,
    currentBoard: 0,
    updateFromRound: 0,
    group: p.group,
  }));

  const roundData: BwsRoundDataRow[] = pending.map((p) => {
    const range =
      input.boardRange ??
      ({ lowBoard: 1, highBoard: p.boardCount } satisfies BwsBoardRange);
    return {
      section: sectionIdByLetter.get(p.sectionLetter)!,
      table: p.table,
      round: BCS_ROUND,
      nsPair: p.nsPair,
      ewPair: p.ewPair,
      lowBoard: range.lowBoard,
      highBoard: range.highBoard,
      customBoards: null,
    };
  });

  const rawName =
    input.sessionName?.trim() || `Honneur ronde ${input.tournamentRoundNumber}`;
  const name =
    rawName.length > MAX_SESSION_NAME
      ? rawName.slice(0, MAX_SESSION_NAME)
      : rawName;

  const guid = options?.guid ?? crypto.randomUUID();
  const braced =
    guid.startsWith("{") ? guid : `{${guid}}`;

  return {
    ok: true,
    plan: {
      session: {
        id: SESSION_ID,
        name,
        guid: braced,
        status: 0,
        showInApp: false,
        pairsMoveAcrossField: false,
        ewReturnHome: false,
      },
      sections,
      tables,
      roundData,
      playerNumbers: [],
      settings: [],
      filename: `honneur-ronde-${input.tournamentRoundNumber}.bws`,
    },
  };
}
