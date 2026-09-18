import type { SpecialResultKind } from "@/lib/boards/types";

export type SpecialResultResolution = {
  specialResultKind: SpecialResultKind;
  includedInDatum: boolean;
  validationStatus: "VALID" | "SPECIAL" | "INVALID";
  requiresAdminResolution: boolean;
  errors: string[];
};

const PERCENTAGE_REMARK = /%|\bpercent(?:age)?\b|\bprocent\b/i;

/** Detect Bridgemate %-style arbitral remarks that must not be silently converted. */
export function isPercentageArbitralRemark(
  remarks: string | null | undefined,
): boolean {
  if (!remarks || !remarks.trim()) return false;
  return PERCENTAGE_REMARK.test(remarks);
}

/**
 * Decide datum inclusion and validation status for special results (PRD §4.8.5).
 */
export function resolveSpecialResultFlags(input: {
  specialResultKind?: SpecialResultKind | null;
  remarks?: string | null;
  datumEligible?: boolean | null;
  hasAdjustedNsScore?: boolean;
  defaultExcludeSpecialFromDatum?: boolean;
  requireAdminResolutionForPercentageArbitral?: boolean;
  adminResolved?: boolean;
}): SpecialResultResolution {
  const defaultExclude = input.defaultExcludeSpecialFromDatum !== false;
  const requirePct =
    input.requireAdminResolutionForPercentageArbitral !== false;
  const kind = input.specialResultKind ?? "NONE";
  const errors: string[] = [];

  if (
    requirePct &&
    isPercentageArbitralRemark(input.remarks) &&
    !input.adminResolved
  ) {
    return {
      specialResultKind: kind === "NONE" ? "ARBITRAL" : kind,
      includedInDatum: false,
      validationStatus: "SPECIAL",
      requiresAdminResolution: true,
      errors: [
        "Procentuele arbitrale score mag niet stilzwijgend worden omgezet. Los dit resultaat handmatig op.",
      ],
    };
  }

  if (kind === "NONE") {
    return {
      specialResultKind: "NONE",
      includedInDatum: true,
      validationStatus: "VALID",
      requiresAdminResolution: false,
      errors: [],
    };
  }

  if (kind === "NOT_PLAYED" || kind === "ERASED" || kind === "ARBITRAL") {
    if (input.adminResolved) {
      return {
        specialResultKind: kind,
        includedInDatum: false,
        validationStatus: "VALID",
        requiresAdminResolution: false,
        errors: [],
      };
    }
    return {
      specialResultKind: kind,
      includedInDatum: false,
      validationStatus: "SPECIAL",
      requiresAdminResolution: true,
      errors:
        kind === "NOT_PLAYED"
          ? ["Resultaat is niet gespeeld — uitgesloten van datum tot oplossing."]
          : kind === "ERASED"
            ? ["Resultaat is gewist — uitgesloten van datum tot oplossing."]
            : ["Arbitraal resultaat vereist oplossing door de beheerder."],
    };
  }

  let includedInDatum = false;
  if (input.datumEligible === true && input.hasAdjustedNsScore) {
    includedInDatum = true;
  } else if (!defaultExclude && input.datumEligible === true && input.hasAdjustedNsScore) {
    includedInDatum = true;
  }

  if (input.datumEligible === true && !input.hasAdjustedNsScore) {
    errors.push(
      "Datum-geschikt gemarkeerd, maar geen aangepaste NS-score aanwezig.",
    );
  }

  return {
    specialResultKind: "ADJUSTED",
    includedInDatum,
    validationStatus: input.adminResolved ? "VALID" : "SPECIAL",
    requiresAdminResolution: false,
    errors,
  };
}

/** Effective NS score for datum: admin adjusted score if set, else computed/ns score. */
export function effectiveNsScoreForDatum(result: {
  adminAdjustedNsScore?: number | null;
  nsScore?: number | null;
  computedScore?: number | null;
}): number | null {
  if (result.adminAdjustedNsScore != null) return result.adminAdjustedNsScore;
  if (result.nsScore != null) return result.nsScore;
  if (result.computedScore != null) return result.computedScore;
  return null;
}
