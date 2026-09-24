import { NextResponse } from "next/server";
import { assertArbiterHonorApiAccess } from "@/lib/auth/arbiter-scope";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { revalidateButlerPublicPages } from "@/lib/butler/revalidate-butler";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import {
  buildAveragePmAdjustment,
  buildCancelledAdjustment,
  buildSplitAdjustment,
  buildWeightedAdjustment,
} from "@/lib/results/adjustment-helpers";
import { resolveHonorSpecialResult } from "@/lib/results/special-resolve";
import type {
  AdjustmentMode,
  AverageAward,
  NonOffendingSide,
  ResolveSpecialInput,
  WeightedScoreLeg,
} from "@/lib/results/types";
import { createServiceClient } from "@/lib/supabase/server-client";
import { jsonError, jsonFromError } from "@/lib/http/api-response";
import type { SpecialResultKind } from "@/lib/boards/types";
import {
  parseMatchImpsOverride,
  parseNonOffendingSide,
} from "@/lib/scoring/weighted-match-imps";

type Params = { params: Promise<{ id: string }> };

function parseKind(raw: unknown): SpecialResultKind | null {
  if (typeof raw !== "string") return null;
  const v = raw.toUpperCase();
  if (
    v === "NONE" ||
    v === "NOT_PLAYED" ||
    v === "ARBITRAL" ||
    v === "ADJUSTED" ||
    v === "ERASED"
  ) {
    return v;
  }
  return null;
}

function numOrNull(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseAverageAward(raw: unknown): AverageAward | null | "invalid" {
  if (raw === undefined || raw === null || raw === "" || raw === "none") {
    return null;
  }
  if (raw === "plus" || raw === "minus" || raw === "zero") return raw;
  return "invalid";
}

function parseWeightedLegs(body: Record<string, unknown>): WeightedScoreLeg[] | null {
  if (Array.isArray(body.legs)) {
    const legs: WeightedScoreLeg[] = [];
    for (const raw of body.legs) {
      if (!raw || typeof raw !== "object") return null;
      const leg = raw as Record<string, unknown>;
      const score = Number(leg.score);
      const weightNs = Number(leg.weightNs ?? leg.weight_ns);
      const weightEw = Number(leg.weightEw ?? leg.weight_ew);
      if (![score, weightNs, weightEw].every((n) => Number.isFinite(n))) {
        return null;
      }
      legs.push({ score, weightNs, weightEw });
    }
    return legs.length >= 1 ? legs : null;
  }

  // Legacy two-leg payload (same weight for NS and EW)
  const scoreA = Number(body.scoreA);
  const weightA = Number(body.weightA);
  const scoreB = Number(body.scoreB);
  const weightB = Number(body.weightB);
  if (![scoreA, weightA, scoreB, weightB].every((n) => Number.isFinite(n))) {
    return null;
  }
  return [
    { score: scoreA, weightNs: weightA, weightEw: weightA },
    { score: scoreB, weightNs: weightB, weightEw: weightB },
  ];
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    await assertArbiterHonorApiAccess(supabase, user.id, roles);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const service = createServiceClient();

    const mode = (body.mode ?? body.adjustmentMode ?? null) as
      | AdjustmentMode
      | null;
    const reason =
      typeof body.reason === "string" ? body.reason : null;

    if (mode === "artificial") {
      return jsonError(
        "Arbitrale score is niet meer beschikbaar. Gebruik gewogen score, correctie of geannuleerd.",
        400,
      );
    }

    let input: ResolveSpecialInput;

    if (mode === "cancelled") {
      const built = buildCancelledAdjustment({ reason });
      input = {
        specialResultKind: built.specialResultKind,
        adminAdjustedNsScore: built.adminAdjustedNsScore,
        adminAdjustedEwScore: built.adminAdjustedEwScore,
        adminNsButlerImps: built.adminNsButlerImps,
        adminEwButlerImps: built.adminEwButlerImps,
        datumEligible: built.datumEligible,
        includedInMatchScore: built.includedInMatchScore,
        adjustmentMode: built.adjustmentMode,
        adjustmentMeta: built.adjustmentMeta,
        reason,
      };
    } else if (mode === "split") {
      const ns = numOrNull(body.adminAdjustedNsScore);
      const ew = numOrNull(body.adminAdjustedEwScore);
      if (ns == null || ew == null) {
        return jsonError("Split-scores vereisen NS- en OW-datumscores.", 400);
      }
      try {
        const built = buildSplitAdjustment({
          adminAdjustedNsScore: ns,
          adminAdjustedEwScore: ew,
          datumEligible:
            body.datumEligible === undefined ? true : Boolean(body.datumEligible),
          reason,
        });
        input = {
          specialResultKind: built.specialResultKind,
          adminAdjustedNsScore: built.adminAdjustedNsScore,
          adminAdjustedEwScore: built.adminAdjustedEwScore,
          adminNsButlerImps: built.adminNsButlerImps,
          adminEwButlerImps: built.adminEwButlerImps,
          datumEligible: built.datumEligible,
          includedInMatchScore: built.includedInMatchScore,
          adjustmentMode: built.adjustmentMode,
          adjustmentMeta: built.adjustmentMeta,
          reason,
        };
      } catch (e) {
        return jsonError(
          e instanceof Error ? e.message : "Ongeldige split-score",
          400,
        );
      }
    } else if (mode === "weighted") {
      const legs = parseWeightedLegs(body);
      if (!legs) {
        return jsonError(
          "Gewogen score vereist minstens één score met NS- en OW-gewichten.",
          400,
        );
      }
      const nonOffendingSide = parseNonOffendingSide(
        body.nonOffendingSide ?? body.non_offending_side,
      );
      if (!nonOffendingSide) {
        return jsonError(
          "Gewogen score vereist een niet-overtredende partij (NZ of OW).",
          400,
        );
      }
      let matchImpsOverride = null as ReturnType<typeof parseMatchImpsOverride>;
      const rawOverride =
        body.matchImpsOverride ?? body.match_imps_override ?? null;
      if (rawOverride != null) {
        matchImpsOverride = parseMatchImpsOverride(rawOverride);
        if (!matchImpsOverride) {
          return jsonError(
            "Handmatige wedstrijd-IMP’s moeten gehele getallen zijn (thuis en uit).",
            400,
          );
        }
      } else if (body.homeImps != null || body.awayImps != null) {
        matchImpsOverride = parseMatchImpsOverride({
          homeImps: body.homeImps,
          awayImps: body.awayImps,
        });
        if (!matchImpsOverride) {
          return jsonError(
            "Handmatige wedstrijd-IMP’s moeten gehele getallen zijn (thuis en uit).",
            400,
          );
        }
      }
      try {
        const built = buildWeightedAdjustment({
          legs,
          nonOffendingSide: nonOffendingSide as NonOffendingSide,
          matchImpsOverride,
          datumEligible:
            body.datumEligible === undefined ? true : Boolean(body.datumEligible),
          reason,
        });
        input = {
          specialResultKind: built.specialResultKind,
          adminAdjustedNsScore: built.adminAdjustedNsScore,
          adminAdjustedEwScore: built.adminAdjustedEwScore,
          adminNsButlerImps: built.adminNsButlerImps,
          adminEwButlerImps: built.adminEwButlerImps,
          datumEligible: built.datumEligible,
          includedInMatchScore: built.includedInMatchScore,
          adjustmentMode: built.adjustmentMode,
          adjustmentMeta: built.adjustmentMeta,
          reason,
        };
      } catch (e) {
        return jsonError(
          e instanceof Error ? e.message : "Ongeldige gewogen score",
          400,
        );
      }
    } else if (mode === "average_pm") {
      const nsAward = parseAverageAward(body.nsAward);
      const ewAward = parseAverageAward(body.ewAward);
      if (nsAward === "invalid" || ewAward === "invalid") {
        return jsonError(
          "Gemiddelde +/- vereist geldige NZ- en OW-toekenningen (plus, minus of none).",
          400,
        );
      }
      try {
        const built = buildAveragePmAdjustment({
          nsAward,
          ewAward,
          reason,
        });
        input = {
          specialResultKind: built.specialResultKind,
          adminAdjustedNsScore: built.adminAdjustedNsScore,
          adminAdjustedEwScore: built.adminAdjustedEwScore,
          adminNsButlerImps: built.adminNsButlerImps,
          adminEwButlerImps: built.adminEwButlerImps,
          datumEligible: built.datumEligible,
          includedInMatchScore: built.includedInMatchScore,
          adjustmentMode: built.adjustmentMode,
          adjustmentMeta: built.adjustmentMeta,
          reason,
        };
      } catch (e) {
        return jsonError(
          e instanceof Error ? e.message : "Ongeldige gemiddelde +/-",
          400,
        );
      }
    } else {
      const kind = parseKind(body.specialResultKind);
      if (!kind) {
        return jsonError("specialResultKind of mode is verplicht.", 400);
      }
      input = {
        specialResultKind: kind,
        adminAdjustedNsScore: numOrNull(body.adminAdjustedNsScore),
        adminAdjustedEwScore: numOrNull(body.adminAdjustedEwScore),
        adminNsButlerImps: numOrNull(body.adminNsButlerImps),
        adminEwButlerImps: numOrNull(body.adminEwButlerImps),
        datumEligible:
          body.datumEligible === undefined
            ? null
            : Boolean(body.datumEligible),
        includedInMatchScore:
          body.includedInMatchScore === undefined
            ? null
            : Boolean(body.includedInMatchScore),
        adjustmentMode: (mode as AdjustmentMode | null) ?? null,
        adjustmentMeta:
          body.adjustmentMeta && typeof body.adjustmentMeta === "object"
            ? (body.adjustmentMeta as Record<string, unknown>)
            : null,
        reason,
      };
    }

    const result = await resolveHonorSpecialResult({
      service,
      resultId: id,
      input,
      userId: user.id,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (result.matchScores.refreshed) {
      await revalidateStandingsForGroup(service, result.groupId);
    }
    revalidateButlerPublicPages();

    return NextResponse.json({
      ok: true,
      resultId: result.resultId,
      boardId: result.boardId,
      tournamentRound: result.tournamentRound,
      matchScores: result.matchScores,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
