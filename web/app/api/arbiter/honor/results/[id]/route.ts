import { NextResponse } from "next/server";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import type {
  ContractDenomination,
  Declarer,
  Doubling,
} from "@/lib/boards/types";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { applyHonorBoardCorrection } from "@/lib/results/corrections";
import type { CorrectionInput } from "@/lib/results/types";
import { createServiceClient } from "@/lib/supabase/server-client";
import { jsonFromError } from "@/lib/http/api-response";

type Params = { params: Promise<{ id: string }> };

function numOrUndef(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { user } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const service = createServiceClient();

    const correction: CorrectionInput = {
      contractLevel: numOrUndef(body.contractLevel ?? body.contract_level),
      contractDenomination: (body.contractDenomination ??
        body.contract_denomination) as ContractDenomination | null | undefined,
      doubling: (body.doubling as Doubling | undefined) ?? undefined,
      declarer: (body.declarer as Declarer | null | undefined) ?? undefined,
      tricksResult:
        (body.tricksResult ?? body.tricks_result) as string | null | undefined,
      tricksTaken: numOrUndef(body.tricksTaken ?? body.tricks_taken),
      nsScore: numOrUndef(body.nsScore ?? body.ns_score),
      reason: typeof body.reason === "string" ? body.reason : null,
    };

    const result = await applyHonorBoardCorrection({
      service,
      resultId: id,
      correction,
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
