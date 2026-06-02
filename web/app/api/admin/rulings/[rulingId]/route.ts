import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { removeOperationalFile } from "@/lib/files/operational-file-storage";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createServiceClient } from "@/lib/supabase/server-client";

type Params = { params: Promise<{ rulingId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { rulingId } = await params;
    const { user, supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();

    const { data: existing, error: loadError } = await supabase
      .from("rulings")
      .select("match_id, file_path")
      .eq("id", rulingId)
      .maybeSingle();

    if (loadError) return jsonError(loadError.message, 500);
    if (!existing) return jsonErrorCode(ErrorCodes.api.rulingNotFound, 404);

    const updates: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (body.board != null) {
      const board = Number(body.board);
      if (!Number.isInteger(board) || board < 1) {
        return jsonErrorCode(ErrorCodes.api.boardPositiveInteger, 400);
      }
      updates.board = board;
    }
    if (body.ruling_date != null) updates.ruling_date = body.ruling_date;
    if (body.file_path != null) updates.file_path = String(body.file_path).trim();

    const { data, error } = await supabase
      .from("rulings")
      .update(updates)
      .eq("id", rulingId)
      .select("id, match_id, board, file_path, ruling_date, updated_at")
      .single();

    if (error) return jsonError(error.message, 400);

    await supabase.from("match_logs").insert({
      match_id: existing.match_id,
      action: "ruling_updated",
      user_id: user.id,
    });

    return jsonOk({ ruling: data });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { rulingId } = await params;
    const { user, supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);

    const { data: existing, error: loadError } = await supabase
      .from("rulings")
      .select("match_id, file_path")
      .eq("id", rulingId)
      .maybeSingle();

    if (loadError) return jsonError(loadError.message, 500);
    if (!existing) return jsonErrorCode(ErrorCodes.api.rulingNotFound, 404);

    const { error } = await supabase.from("rulings").delete().eq("id", rulingId);

    if (error) return jsonError(error.message, 400);

    const service = createServiceClient();
    try {
      await removeOperationalFile(service, existing.file_path);
    } catch {
      // Storage cleanup is best-effort
    }

    await supabase.from("match_logs").insert({
      match_id: existing.match_id,
      action: "ruling_deleted",
      user_id: user.id,
    });

    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
