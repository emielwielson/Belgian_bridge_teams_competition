import { randomUUID } from "node:crypto";
import { COMPETITION_ADMIN_ROLES, requireAuth } from "@/lib/auth/route-auth";
import { ARBITER_ACCESS_ROLES, hasAnyRole } from "@/lib/auth/roles";
import {
  buildOperationalStoragePath,
  validateOperationalFile,
  type OperationalFilePurpose,
} from "@/lib/files/operational-file-upload";
import {
  createOperationalSignedUrl,
  uploadOperationalFile,
} from "@/lib/files/operational-file-storage";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { createServiceClient } from "@/lib/supabase/server-client";

async function assertCanUploadForPurpose(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
  purpose: OperationalFilePurpose,
  matchId: string,
  roles: string[],
): Promise<void> {
  if (purpose === "ruling") {
    if (!hasAnyRole(roles, [...ARBITER_ACCESS_ROLES])) {
      throw new Error("Forbidden");
    }
    return;
  }

  if (purpose === "penalty") {
    if (!hasAnyRole(roles, [...ARBITER_ACCESS_ROLES])) {
      throw new Error("Forbidden");
    }
    const teamId = matchId;
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .maybeSingle();
    if (teamError) throw teamError;
    if (!team) throw new Error("Team not found");
    return;
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError) throw matchError;
  if (!match) throw new Error("Match not found");

  const [homeCap, awayCap] = await Promise.all([
    supabase.rpc("current_user_is_captain_of_team", {
      p_team_id: match.home_team_id,
    }),
    supabase.rpc("current_user_is_captain_of_team", {
      p_team_id: match.away_team_id,
    }),
  ]);

  const isCaptain = Boolean(homeCap.data) || Boolean(awayCap.data);
  if (!isCaptain && !hasAnyRole(roles, [...COMPETITION_ADMIN_ROLES])) {
    throw new Error("Forbidden");
  }
}

export async function POST(request: Request) {
  try {
    const { roles, supabase } = await requireAuth();
    const formData = await request.formData();
    const file = formData.get("file");
    const purposeRaw = formData.get("purpose");
    const matchIdRaw = formData.get("matchId");

    if (!(file instanceof File)) {
      return jsonError("file is required", 400);
    }
    if (typeof purposeRaw !== "string" || !purposeRaw.trim()) {
      return jsonError("purpose is required", 400);
    }
    if (typeof matchIdRaw !== "string" || !matchIdRaw.trim()) {
      return jsonError("matchId is required", 400);
    }

    const purpose = purposeRaw.trim() as OperationalFilePurpose;
    if (purpose !== "ruling" && purpose !== "arbiter_request" && purpose !== "penalty") {
      return jsonError("purpose must be ruling, arbiter_request, or penalty", 400);
    }

    const matchId = matchIdRaw.trim();
    const entityId =
      purpose === "penalty"
        ? (formData.get("teamId") as string | null)?.trim() ?? matchId
        : matchId;

    if (purpose === "penalty" && !entityId) {
      return jsonError("teamId is required for penalty uploads", 400);
    }

    await assertCanUploadForPurpose(supabase, purpose, entityId, roles);

    const validated = validateOperationalFile(file);
    const fileId = randomUUID();
    const storagePath = buildOperationalStoragePath({
      purpose,
      entityId,
      extension: validated.extension,
      fileId,
    });

    const service = createServiceClient();
    const buffer = await file.arrayBuffer();
    await uploadOperationalFile(service, storagePath, buffer, validated);

    const signedUrl = await createOperationalSignedUrl(service, storagePath);

    return jsonOk({ path: storagePath, signedUrl }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return jsonError("Forbidden", 403);
    }
    return jsonFromError(err);
  }
}
