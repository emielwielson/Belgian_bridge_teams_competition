import type { Vulnerability } from "@/lib/boards/types";
import { computeNsContractScore } from "@/lib/scoring/contract-score";
import {
  isPercentageArbitralRemark,
  resolveSpecialResultFlags,
} from "@/lib/butler/special-results";
import type {
  NormalizedBoardResultInput,
  ResultValidationIssue,
} from "@/lib/results/types";

const DENOMINATIONS = new Set([
  "CLUBS",
  "DIAMONDS",
  "HEARTS",
  "SPADES",
  "NT",
  "PASS",
]);
const DECLARERS = new Set(["N", "E", "S", "W"]);
const DOUBLINGS = new Set(["NONE", "DOUBLED", "REDOUBLED"]);

export type ValidationContext = {
  matchId: string;
  tableId: string;
  tableMatchId: string;
  boardId: string;
  boardTournamentRound: number;
  matchTournamentRound: number;
  boardVulnerability: Vulnerability | null;
  existingResultForTableBoard: boolean;
  tableNsPairId: string | null;
  tableEwPairId: string | null;
};

export type ValidatedResult = {
  issues: ResultValidationIssue[];
  computedScore: number | null;
  nsScore: number | null;
  validationStatus: "VALID" | "INVALID" | "SPECIAL";
  includedInDatum: boolean;
  specialResultKind: NormalizedBoardResultInput["specialResultKind"];
  requiresAdminResolution: boolean;
};

function legalTricksResult(raw: string | null | undefined): boolean {
  if (raw == null || raw === "") return true;
  const t = raw.trim().toUpperCase();
  if (t === "=" || t === "PASS") return true;
  return /^[+-]\d+$/.test(t);
}

export function validateNormalizedResult(
  input: NormalizedBoardResultInput,
  ctx: ValidationContext,
  opts?: {
    defaultExcludeSpecialFromDatum?: boolean;
    requireAdminResolutionForPercentageArbitral?: boolean;
  },
): ValidatedResult {
  const issues: ResultValidationIssue[] = [];

  if (ctx.tableMatchId !== ctx.matchId) {
    issues.push({
      code: "ASSOC_TABLE_MATCH",
      message: "Tafel hoort niet bij de opgegeven wedstrijd.",
    });
  }
  if (input.matchId !== ctx.matchId) {
    issues.push({
      code: "ASSOC_MATCH",
      message: "Wedstrijd-id komt niet overeen.",
    });
  }
  if (input.tableId !== ctx.tableId) {
    issues.push({
      code: "ASSOC_TABLE",
      message: "Tafel-id komt niet overeen.",
    });
  }
  if (input.boardId !== ctx.boardId) {
    issues.push({
      code: "ASSOC_BOARD",
      message: "Bord-id komt niet overeen.",
    });
  }
  if (ctx.boardTournamentRound !== ctx.matchTournamentRound) {
    issues.push({
      code: "ASSOC_ROUND",
      message: "Bord hoort niet bij dezelfde ronde als de wedstrijd.",
    });
  }

  if (ctx.existingResultForTableBoard) {
    issues.push({
      code: "DUPLICATE",
      message: "Er bestaat al een resultaat voor deze tafel en dit bord.",
    });
  }

  if (
    input.nsPairId &&
    ctx.tableNsPairId &&
    input.nsPairId !== ctx.tableNsPairId
  ) {
    issues.push({
      code: "ASSOC_NS_PAIR",
      message: "NS-paar komt niet overeen met de tafeltoewijzing.",
    });
  }
  if (
    input.ewPairId &&
    ctx.tableEwPairId &&
    input.ewPairId !== ctx.tableEwPairId
  ) {
    issues.push({
      code: "ASSOC_EW_PAIR",
      message: "OW-paar komt niet overeen met de tafeltoewijzing.",
    });
  }

  let kind = input.specialResultKind ?? "NONE";
  if (isPercentageArbitralRemark(input.remarks) && kind === "NONE") {
    kind = "ARBITRAL";
  }

  const special = resolveSpecialResultFlags({
    specialResultKind: kind,
    remarks: input.remarks,
    defaultExcludeSpecialFromDatum: opts?.defaultExcludeSpecialFromDatum,
    requireAdminResolutionForPercentageArbitral:
      opts?.requireAdminResolutionForPercentageArbitral,
  });
  issues.push(
    ...special.errors.map((message) => ({ code: "SPECIAL", message })),
  );

  const denom = input.contractDenomination ?? null;
  const doubling = input.doubling ?? "NONE";
  const declarer = input.declarer ?? null;

  if (denom != null && !DENOMINATIONS.has(denom)) {
    issues.push({
      code: "CONTRACT_DENOM",
      message: "Ongeldige contractkleur.",
    });
  }
  if (!DOUBLINGS.has(doubling)) {
    issues.push({ code: "CONTRACT_X", message: "Ongeldige doubling." });
  }
  if (declarer != null && !DECLARERS.has(declarer)) {
    issues.push({ code: "DECLARER", message: "Ongeldige declarer." });
  }
  if (
    denom !== "PASS" &&
    denom != null &&
    (input.contractLevel == null ||
      input.contractLevel < 1 ||
      input.contractLevel > 7)
  ) {
    issues.push({
      code: "CONTRACT_LEVEL",
      message: "Contractniveau moet 1–7 zijn.",
    });
  }
  if (!legalTricksResult(input.tricksResult)) {
    issues.push({
      code: "TRICKS",
      message: "Ongeldig resultaat (verwacht =, +n, -n of PASS).",
    });
  }

  let computedScore: number | null = null;
  if (kind === "NONE" && ctx.boardVulnerability) {
    computedScore = computeNsContractScore({
      contractLevel: input.contractLevel ?? null,
      contractDenomination: denom,
      doubling,
      declarer,
      tricksTaken: input.tricksTaken,
      tricksResult: input.tricksResult,
      vulnerability: ctx.boardVulnerability,
    });
  }

  const bridgemate = input.bridgemateScore ?? null;
  let nsScore: number | null = bridgemate;
  if (computedScore != null) {
    nsScore = computedScore;
    if (bridgemate != null && bridgemate !== computedScore) {
      issues.push({
        code: "SCORE_MISMATCH",
        message: `Bridgemate-score ${bridgemate} wijkt af van berekende score ${computedScore}.`,
      });
    }
  }

  const hasHard =
    issues.some((i) => i.code.startsWith("ASSOC_") || i.code === "DUPLICATE") ||
    (special.validationStatus === "INVALID");

  let validationStatus: ValidatedResult["validationStatus"] =
    special.validationStatus;
  if (hasHard) validationStatus = "INVALID";
  else if (
    issues.some((i) => i.code === "CONTRACT_LEVEL" || i.code === "CONTRACT_DENOM")
  ) {
    validationStatus = "INVALID";
  }

  return {
    issues,
    computedScore,
    nsScore,
    validationStatus,
    includedInDatum: special.includedInDatum && validationStatus === "VALID",
    specialResultKind: special.specialResultKind,
    requiresAdminResolution: special.requiresAdminResolution,
  };
}
