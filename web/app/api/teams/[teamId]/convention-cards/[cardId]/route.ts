import { requireAuth } from "@/lib/auth/route-auth";
import { assertCanManageTeamConventionCards } from "@/lib/auth/team-access";
import {
  getConventionCard,
  listConventionCards,
} from "@/lib/competition/convention-card-queries";
import {
  conventionCardStoragePath,
  sanitizeConventionCardFilename,
  validateConventionCardFile,
} from "@/lib/files/convention-card-upload";
import {
  removeConventionCardFile,
  uploadConventionCardFile,
} from "@/lib/files/convention-card-storage";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import {
  createServiceClient,
  createSessionClient,
} from "@/lib/supabase/server-client";

type CardParams = {
  params: Promise<{ teamId: string; cardId: string }>;
};

export async function PATCH(request: Request, { params }: CardParams) {
  try {
    const { teamId, cardId } = await params;
    const { user, supabase } = await requireAuth();
    await assertCanManageTeamConventionCards(supabase, teamId);

    const existing = await getConventionCard(supabase, teamId, cardId);
    if (!existing) {
      return jsonErrorCode(ErrorCodes.api.conventionCardNotFound, 404);
    }

    const contentType = request.headers.get("content-type") ?? "";
    let name: string | undefined;
    let file: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const nameRaw = formData.get("name");
      if (typeof nameRaw === "string" && nameRaw.trim()) {
        name = nameRaw.trim();
      }
      const fileField = formData.get("file");
      if (fileField instanceof File && fileField.size > 0) {
        file = fileField;
      }
    } else {
      const body = await request.json();
      if (typeof body.name === "string" && body.name.trim()) {
        name = body.name.trim();
      }
    }

    if (name === undefined && !file) {
      return jsonErrorCode(ErrorCodes.api.conventionUpdateRequired, 400);
    }

    const service = createServiceClient();
    let storagePath = existing.storage_path;
    let fileMime = existing.file_mime;
    let fileSize = existing.file_size_bytes;

    if (file) {
      const validated = validateConventionCardFile(file);
      const filename = sanitizeConventionCardFilename(
        file.name || (name ?? existing.name),
        validated.extension,
      );
      const newPath = conventionCardStoragePath(teamId, cardId, filename);
      const buffer = await file.arrayBuffer();
      await uploadConventionCardFile(service, newPath, buffer, validated);
      if (newPath !== existing.storage_path) {
        await removeConventionCardFile(service, existing.storage_path);
      }
      storagePath = newPath;
      fileMime = validated.mime;
      fileSize = validated.size;
    }

    const { error: updateError } = await supabase
      .from("team_convention_cards")
      .update({
        name: name ?? existing.name,
        storage_path: storagePath,
        file_mime: fileMime,
        file_size_bytes: fileSize,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId)
      .eq("team_id", teamId);

    if (updateError) {
      return jsonError(updateError.message, 400);
    }

    const cards = await listConventionCards(supabase, teamId);
    return jsonOk({ cards });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(_request: Request, { params }: CardParams) {
  try {
    const { teamId, cardId } = await params;
    const { supabase } = await requireAuth();
    await assertCanManageTeamConventionCards(supabase, teamId);

    const existing = await getConventionCard(supabase, teamId, cardId);
    if (!existing) {
      return jsonErrorCode(ErrorCodes.api.conventionCardNotFound, 404);
    }

    const { error: deleteError } = await supabase
      .from("team_convention_cards")
      .delete()
      .eq("id", cardId)
      .eq("team_id", teamId);

    if (deleteError) {
      return jsonError(deleteError.message, 400);
    }

    const service = createServiceClient();
    await removeConventionCardFile(service, existing.storage_path);

    const cards = await listConventionCards(supabase, teamId);
    return jsonOk({ cards });
  } catch (err) {
    return jsonFromError(err);
  }
}
