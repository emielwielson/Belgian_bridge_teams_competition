import { NextResponse } from "next/server";
import { assertArbiterHonorApiAccess } from "@/lib/auth/arbiter-scope";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { importHonorBwsForRound } from "@/lib/bridgemate/import-round";
import {
  defaultHonorRound,
  loadHonorRoundMeta,
  loadHonorRoundSeating,
  resolveActiveHonorGroup,
} from "@/lib/competition/honor-seating-overview";
import { createServiceClient } from "@/lib/supabase/server-client";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { jsonError, jsonFromError } from "@/lib/http/api-response";

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
    const requested = Number(roundSeg);
    const round =
      Number.isInteger(requested) &&
      requested >= 1 &&
      requested <= group.round_count
        ? requested
        : defaultHonorRound(meta);

    const seating = await loadHonorRoundSeating(service, group, round);

    const contentType = request.headers.get("content-type") ?? "";
    let buffer: Buffer | null = null;
    let filename: string | null = null;
    let replace = true;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return jsonError(".bws-bestand ontbreekt (field: file).", 400);
      }
      filename = file.name;
      buffer = Buffer.from(await file.arrayBuffer());
      const replaceField = form.get("replace");
      if (replaceField === "false" || replaceField === "0") replace = false;
    } else {
      return jsonError("Verwacht multipart/form-data met .bws-bestand.", 400);
    }

    const result = await importHonorBwsForRound({
      service,
      groupId: group.id,
      tournamentRound: round,
      matches: seating.matches,
      buffer,
      filename,
      uploadedBy: user.id,
      replace,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          mappingErrors: result.mappingErrors ?? [],
        },
        { status: 400 },
      );
    }

    if (result.matchScores && result.matchScores.length > 0) {
      await revalidateStandingsForGroup(service, group.id);
    }

    return NextResponse.json({
      round,
      rawImportId: result.rawImportId,
      mappedCount: result.mappedCount,
      failedMappingCount: result.failedMappingCount,
      created: result.created,
      failedIngest: result.failedIngest,
      mappingErrors: result.mappingErrors,
      butlerUpdated: result.butlerUpdated,
      matchScores: result.matchScores,
      ok: true,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
