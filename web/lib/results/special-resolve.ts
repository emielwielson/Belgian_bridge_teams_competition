/**
 * Resolve special / arbitral Honor board results (arbiter).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSpecialResultFlags } from "@/lib/butler/special-results";
import { recalculateHonorButler } from "@/lib/butler/recalculate";
import type { ResolveSpecialInput } from "@/lib/results/types";
import {
  maybeRefreshPublishedMatchScores,
  type RefreshMatchScoresResult,
} from "@/lib/results/refresh-published-scores";

function kindToDb(kind: string): string {
  switch (kind) {
    case "NOT_PLAYED":
      return "not_played";
    case "ARBITRAL":
      return "arbitral";
    case "ADJUSTED":
      return "adjusted";
    case "ERASED":
      return "erased";
    default:
      return "none";
  }
}

export async function resolveHonorSpecialResult(params: {
  service: SupabaseClient;
  resultId: string;
  input: ResolveSpecialInput;
  userId: string;
}): Promise<
  | {
      ok: true;
      resultId: string;
      boardId: string;
      groupId: string;
      tournamentRound: number;
      matchScores: RefreshMatchScoresResult;
    }
  | { ok: false; error: string }
> {
  const { data: existing, error: loadErr } = await params.service
    .from("honor_board_results")
    .select(
      "id, group_id, match_id, board_id, tournament_round, room, special_result_kind, ns_score, admin_adjusted_ns_score, admin_adjusted_ew_score, admin_ns_butler_imps, admin_ew_butler_imps, datum_eligible, included_in_datum, included_in_match_score",
    )
    .eq("id", params.resultId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!existing) return { ok: false, error: "Resultaat niet gevonden." };

  if (params.input.adjustmentMode === "artificial") {
    return {
      ok: false,
      error:
        "Arbitrale score is niet meer beschikbaar. Gebruik gewogen score, correctie of geannuleerd.",
    };
  }

  const kind = params.input.specialResultKind;
  const adminAdjustedNsScore =
    params.input.adminAdjustedNsScore !== undefined
      ? params.input.adminAdjustedNsScore
      : existing.admin_adjusted_ns_score;
  const adminAdjustedEwScore =
    params.input.adminAdjustedEwScore !== undefined
      ? params.input.adminAdjustedEwScore
      : existing.admin_adjusted_ew_score;
  const adminNsButlerImps =
    params.input.adminNsButlerImps !== undefined
      ? params.input.adminNsButlerImps
      : existing.admin_ns_butler_imps;
  const adminEwButlerImps =
    params.input.adminEwButlerImps !== undefined
      ? params.input.adminEwButlerImps
      : existing.admin_ew_butler_imps;

  if (
    kind === "ADJUSTED" &&
    params.input.datumEligible === true &&
    adminAdjustedNsScore == null
  ) {
    return {
      ok: false,
      error: "Voor datum-geschiktheid is een aangepaste NS-score verplicht.",
    };
  }

  if (
    params.input.adjustmentMode === "split" &&
    (adminAdjustedNsScore == null || adminAdjustedEwScore == null)
  ) {
    return {
      ok: false,
      error: "Split-scores vereisen NS- en OW-datumscores.",
    };
  }

  const flags = resolveSpecialResultFlags({
    specialResultKind: kind,
    datumEligible: params.input.datumEligible,
    hasAdjustedNsScore: adminAdjustedNsScore != null,
    adminResolved: true,
  });

  const includedInDatum =
    kind === "ADJUSTED"
      ? params.input.datumEligible === true && adminAdjustedNsScore != null
      : false;

  const includedInMatchScore =
    params.input.includedInMatchScore != null
      ? params.input.includedInMatchScore
      : kind === "NOT_PLAYED" || kind === "ERASED"
        ? false
        : adminAdjustedNsScore != null || kind === "NONE";

  const nsScore =
    adminAdjustedNsScore != null ? adminAdjustedNsScore : existing.ns_score;

  const now = new Date().toISOString();
  const { error: updateErr } = await params.service
    .from("honor_board_results")
    .update({
      special_result_kind: kindToDb(kind),
      admin_adjusted_ns_score: adminAdjustedNsScore,
      admin_adjusted_ew_score: adminAdjustedEwScore,
      admin_ns_butler_imps: adminNsButlerImps,
      admin_ew_butler_imps: adminEwButlerImps,
      datum_eligible: params.input.datumEligible ?? null,
      included_in_datum: includedInDatum,
      included_in_match_score: includedInMatchScore,
      ns_score: nsScore,
      validation_status: flags.requiresAdminResolution ? "special" : "valid",
      validation_errors: flags.errors.length ? flags.errors : [],
      correction_status: "corrected",
      corrected_at: now,
      adjustment_mode: params.input.adjustmentMode ?? null,
      adjustment_meta: {
        ...(params.input.adjustmentMeta ?? {}),
        reason: params.input.reason ?? null,
        previous: {
          special_result_kind: existing.special_result_kind,
          admin_adjusted_ns_score: existing.admin_adjusted_ns_score,
          admin_adjusted_ew_score: existing.admin_adjusted_ew_score,
          admin_ns_butler_imps: existing.admin_ns_butler_imps,
          admin_ew_butler_imps: existing.admin_ew_butler_imps,
          datum_eligible: existing.datum_eligible,
          included_in_datum: existing.included_in_datum,
          included_in_match_score: existing.included_in_match_score,
          ns_score: existing.ns_score,
        },
      },
      import_source: "correction",
      updated_at: now,
    })
    .eq("id", existing.id);

  if (updateErr) return { ok: false, error: updateErr.message };

  const butler = await recalculateHonorButler(params.service, {
    groupId: existing.group_id as string,
    boardId: existing.board_id as string,
  });
  if (!butler.ok) return { ok: false, error: butler.error };

  const matchScores = await maybeRefreshPublishedMatchScores(params.service, {
    groupId: existing.group_id as string,
    tournamentRound: existing.tournament_round as number,
    userId: params.userId,
  });

  return {
    ok: true,
    resultId: existing.id as string,
    boardId: existing.board_id as string,
    groupId: existing.group_id as string,
    tournamentRound: existing.tournament_round as number,
    matchScores,
  };
}
