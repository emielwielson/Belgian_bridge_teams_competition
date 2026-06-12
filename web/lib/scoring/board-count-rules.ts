import type { CompetitionScope } from "@/lib/competition/scopes";

export type DivisionLevelCode = "honor" | "first" | "second" | "third";

export type ScoringContext = {
  leagueScope: CompetitionScope;
  divisionLevelCode: DivisionLevelCode;
};

export const BOARD_CHOICE_OPTIONS = [28, 32] as const;
export type BoardChoice = (typeof BOARD_CHOICE_OPTIONS)[number];

export function allowsBoardChoice(ctx: ScoringContext): boolean {
  return (
    ctx.leagueScope === "regional" &&
    (ctx.divisionLevelCode === "second" || ctx.divisionLevelCode === "third")
  );
}

/** Fixed nominal board count, or null when the scorer must pick 28 or 32. */
export function nominalBoardCount(ctx: ScoringContext): number | null {
  if (allowsBoardChoice(ctx)) return null;

  if (ctx.leagueScope === "national") {
    if (ctx.divisionLevelCode === "honor") return 16;
    if (ctx.divisionLevelCode === "first") return 20;
    return 32;
  }

  // Regional
  return 32;
}

/** Default nominal boards stamped on matches at schedule time (before score entry). */
export function scheduledBoardCount(ctx: ScoringContext): number {
  return nominalBoardCount(ctx) ?? 32;
}

export function vpBoardCount(nominal: number, misSeating: boolean): number {
  if (!misSeating) return nominal;
  return (nominal * 3) / 4;
}

export function isValidBoardChoice(value: number): value is BoardChoice {
  return value === 28 || value === 32;
}

/** All VP table board counts to seed for a group (nominals + mis-seating variants). */
export function vpBoardCountsForGroup(ctx: ScoringContext): number[] {
  const counts = new Set<number>();

  const fixed = nominalBoardCount(ctx);
  if (fixed != null) {
    counts.add(fixed);
    counts.add(vpBoardCount(fixed, true));
  } else {
    for (const choice of BOARD_CHOICE_OPTIONS) {
      counts.add(choice);
      counts.add(vpBoardCount(choice, true));
    }
  }

  return [...counts].sort((a, b) => a - b);
}

export function resolveNominalBoardCount(
  ctx: ScoringContext,
  selectedBoardCount: number | null | undefined,
): number {
  const fixed = nominalBoardCount(ctx);
  if (fixed != null) return fixed;

  if (selectedBoardCount == null || !isValidBoardChoice(selectedBoardCount)) {
    throw new BoardCountValidationError(
      "Board count (28 or 32) is required for this division",
    );
  }
  return selectedBoardCount;
}

export class BoardCountValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoardCountValidationError";
  }
}

export function validateScoreBoardOptions(
  ctx: ScoringContext,
  options: {
    selectedBoardCount?: number | null;
    misSeating?: boolean;
  },
): { nominal: number; vpBoardCount: number; misSeating: boolean } {
  if (
    options.selectedBoardCount != null &&
    !allowsBoardChoice(ctx)
  ) {
    throw new BoardCountValidationError(
      "Board count selection is not allowed for this division",
    );
  }

  const misSeating = options.misSeating ?? false;
  const nominal = resolveNominalBoardCount(ctx, options.selectedBoardCount);
  const effectiveVpBoardCount = vpBoardCount(nominal, misSeating);

  return {
    nominal,
    vpBoardCount: effectiveVpBoardCount,
    misSeating,
  };
}
