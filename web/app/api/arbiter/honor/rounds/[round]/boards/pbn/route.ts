import { NextResponse } from "next/server";
import { assertArbiterHonorApiAccess } from "@/lib/auth/arbiter-scope";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { importPbnForHonorRound } from "@/lib/boards/import-pbn";
import {
  defaultHonorRound,
  loadHonorRoundMeta,
  resolveActiveHonorGroup,
} from "@/lib/competition/honor-seating-overview";
import { createServiceClient } from "@/lib/supabase/server-client";
import { jsonError, jsonFromError } from "@/lib/http/api-response";

function resolveRound(
  roundParam: string | null,
  groupRoundCount: number,
  meta: { round: number; datetime: string }[],
): number {
  const requested = roundParam ? Number(roundParam) : NaN;
  if (
    Number.isInteger(requested) &&
    requested >= 1 &&
    requested <= groupRoundCount
  ) {
    return requested;
  }
  return defaultHonorRound(meta);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ round: string }> },
) {
  try {
    const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    await assertArbiterHonorApiAccess(supabase, user.id, roles);
    const service = createServiceClient();
    const group = await resolveActiveHonorGroup(service);
    if (!group) {
      return jsonError("Honor division group not found for the active season", 404);
    }

    const { round: roundSeg } = await context.params;
    const meta = await loadHonorRoundMeta(service, group.id);
    const round = resolveRound(roundSeg, group.round_count, meta);

    const contentType = request.headers.get("content-type") ?? "";
    let pbnText: string;
    let filename: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return jsonError("PBN-bestand ontbreekt (field: file).", 400);
      }
      filename = file.name;
      pbnText = await file.text();
    } else {
      const body = (await request.json().catch(() => null)) as {
        pbn?: string;
      } | null;
      if (!body?.pbn) {
        return jsonError("PBN-tekst ontbreekt.", 400);
      }
      pbnText = body.pbn;
    }

    const result = await importPbnForHonorRound(service, {
      groupId: group.id,
      tournamentRound: round,
      pbnText,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.errors[0] ?? "PBN-import mislukt.", errors: result.errors },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      round,
      boardCount: result.boardCount,
      boardIds: result.boardIds,
      filename,
      uploaded_by: user.id,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
