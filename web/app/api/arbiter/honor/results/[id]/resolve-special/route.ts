import { NextResponse } from "next/server";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import {
  buildArtificialAdjustment,
  buildCancelledAdjustment,
  buildSplitAdjustment,
  buildWeightedAdjustment,
} from "@/lib/results/adjustment-helpers";
import { resolveHonorSpecialResult } from "@/lib/results/special-resolve";
import type {
  AdjustmentMode,
  ResolveSpecialInput,
} from "@/lib/results/types";
import { createServiceClient } from "@/lib/supabase/server-client";
import { jsonError, jsonFromError } from "@/lib/http/api-response";
import type { SpecialResultKind } from "@/lib/boards/types";

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

export async function POST(request: Request, { params }: Params) {
  try {
    const { user } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const service = createServiceClient();

    const mode = (body.mode ?? body.adjustmentMode ?? null) as
      | AdjustmentMode
      | null;
    const reason =
      typeof body.reason === "string" ? body.reason : null;

    let input: ResolveSpecialInput;

    if (mode === "cancelled") {
      const built = buildCancelledAdjustment({ reason });
      input = {
        specialResultKind: built.specialResultKind,
        adminAdjustedNsScore: built.adminAdjustedNsScore,
        adminNsButlerImps: built.adminNsButlerImps,
        adminEwButlerImps: built.adminEwButlerImps,
        datumEligible: built.datumEligible,
        includedInMatchScore: built.includedInMatchScore,
        adjustmentMode: built.adjustmentMode,
        adjustmentMeta: built.adjustmentMeta,
        reason,
      };
    } else if (mode === "artificial") {
      try {
        const built = buildArtificialAdjustment({
          adminAdjustedNsScore: numOrNull(body.adminAdjustedNsScore),
          adminNsButlerImps: numOrNull(body.adminNsButlerImps),
          adminEwButlerImps: numOrNull(body.adminEwButlerImps),
          datumEligible: Boolean(body.datumEligible),
          reason,
        });
        input = {
          specialResultKind: built.specialResultKind,
          adminAdjustedNsScore: built.adminAdjustedNsScore,
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
          e instanceof Error ? e.message : "Ongeldige arbitrale score",
          400,
        );
      }
    } else if (mode === "split") {
      const ns = numOrNull(body.adminNsButlerImps);
      const ew = numOrNull(body.adminEwButlerImps);
      if (ns == null || ew == null) {
        return jsonError("Split-scores vereisen NS- en EW-Butler-IMP’s.", 400);
      }
      try {
        const built = buildSplitAdjustment({
          adminNsButlerImps: ns,
          adminEwButlerImps: ew,
          adminAdjustedNsScore: numOrNull(body.adminAdjustedNsScore),
          datumEligible: Boolean(body.datumEligible),
          reason,
        });
        input = {
          specialResultKind: built.specialResultKind,
          adminAdjustedNsScore: built.adminAdjustedNsScore,
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
      const scoreA = Number(body.scoreA);
      const weightA = Number(body.weightA);
      const scoreB = Number(body.scoreB);
      const weightB = Number(body.weightB);
      if (
        ![scoreA, weightA, scoreB, weightB].every((n) => Number.isFinite(n))
      ) {
        return jsonError("Gewogen score vereist twee scores en gewichten.", 400);
      }
      try {
        const built = buildWeightedAdjustment({
          scoreA,
          weightA,
          scoreB,
          weightB,
          datumEligible:
            body.datumEligible === undefined ? true : Boolean(body.datumEligible),
          adminNsButlerImps: numOrNull(body.adminNsButlerImps),
          adminEwButlerImps: numOrNull(body.adminEwButlerImps),
          reason,
        });
        input = {
          specialResultKind: built.specialResultKind,
          adminAdjustedNsScore: built.adminAdjustedNsScore,
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
    } else {
      const kind = parseKind(body.specialResultKind);
      if (!kind) {
        return jsonError("specialResultKind of mode is verplicht.", 400);
      }
      input = {
        specialResultKind: kind,
        adminAdjustedNsScore: numOrNull(body.adminAdjustedNsScore),
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
