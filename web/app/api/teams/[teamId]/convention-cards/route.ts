import { randomUUID } from "node:crypto";
import { requireAuth } from "@/lib/auth/route-auth";
import { assertCanManageTeamConventionCards } from "@/lib/auth/team-access";
import { listConventionCards } from "@/lib/competition/convention-card-queries";
import {
  conventionCardStoragePath,
  sanitizeConventionCardFilename,
  validateConventionCardFile,
} from "@/lib/files/convention-card-upload";
import { uploadConventionCardFile } from "@/lib/files/convention-card-storage";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";
import {
  createServiceClient,
  createSessionClient,
} from "@/lib/supabase/server-client";

type TeamParams = { params: Promise<{ teamId: string }> };

export async function GET(_request: Request, { params }: TeamParams) {
  try {
    const { teamId } = await params;
    const supabase = await createSessionClient();
    const cards = await listConventionCards(supabase, teamId);
    return jsonOk({ cards });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request, { params }: TeamParams) {
  try {
    const { teamId } = await params;
    const { user, supabase } = await requireAuth();
    await assertCanManageTeamConventionCards(supabase, teamId);

    const formData = await request.formData();
    const nameRaw = formData.get("name");
    const file = formData.get("file");

    if (typeof nameRaw !== "string" || !nameRaw.trim()) {
      return jsonError("name is required", 400);
    }
    if (!(file instanceof File)) {
      return jsonError("file is required", 400);
    }

    const validated = validateConventionCardFile(file);
    const cardId = randomUUID();
    const filename = sanitizeConventionCardFilename(
      file.name || nameRaw.trim(),
      validated.extension,
    );
    const storagePath = conventionCardStoragePath(teamId, cardId, filename);
    const name = nameRaw.trim();

    const { data: row, error: insertError } = await supabase
      .from("team_convention_cards")
      .insert({
        id: cardId,
        team_id: teamId,
        name,
        storage_path: storagePath,
        file_mime: validated.mime,
        file_size_bytes: validated.size,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      return jsonError(insertError.message, 400);
    }

    const service = createServiceClient();
    try {
      const buffer = await file.arrayBuffer();
      await uploadConventionCardFile(service, storagePath, buffer, validated);
    } catch (uploadErr) {
      await supabase.from("team_convention_cards").delete().eq("id", row.id);
      return jsonError(
        uploadErr instanceof Error ? uploadErr.message : "Upload failed",
        400,
      );
    }

    const cards = await listConventionCards(supabase, teamId);
    return jsonOk({ card_id: row.id, cards }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}
