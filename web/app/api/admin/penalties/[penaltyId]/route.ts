import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { revalidateStandingsForTeam } from "@/lib/competition/revalidate-standings";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

type Params = { params: Promise<{ penaltyId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { penaltyId } = await params;
    const { user, supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();

    const updates: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (body.penalty_date != null) updates.penalty_date = body.penalty_date;
    if (body.reason != null) updates.reason = String(body.reason).trim();
    if (body.vp_deduction != null) {
      const vp = Number(body.vp_deduction);
      if (!Number.isFinite(vp) || vp < 0) {
        return jsonErrorCode(ErrorCodes.api.vpDeductionNonNegative, 400);
      }
      updates.vp_deduction = vp;
    }
    if (body.team_id != null) updates.team_id = body.team_id;
    if (body.file_path != null || body.filePath != null) {
      const raw = body.file_path ?? body.filePath;
      updates.file_path =
        raw != null && String(raw).trim() !== "" ? String(raw).trim() : null;
    }

    const { data, error } = await supabase
      .from("penalties")
      .update(updates)
      .eq("id", penaltyId)
      .select(
        "id, team_id, penalty_date, reason, vp_deduction, file_path, updated_at",
      )
      .single();

    if (error) return jsonError(error.message, 400);
    if (!data) return jsonErrorCode(ErrorCodes.api.penaltyNotFound, 404);

    await revalidateStandingsForTeam(supabase, data.team_id);

    return jsonOk({ penalty: data });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { penaltyId } = await params;
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);

    const { data: existing, error: loadError } = await supabase
      .from("penalties")
      .select("team_id")
      .eq("id", penaltyId)
      .maybeSingle();

    if (loadError) return jsonError(loadError.message, 500);
    if (!existing) return jsonErrorCode(ErrorCodes.api.penaltyNotFound, 404);

    const { error } = await supabase
      .from("penalties")
      .delete()
      .eq("id", penaltyId);

    if (error) return jsonError(error.message, 400);

    await revalidateStandingsForTeam(supabase, existing.team_id);

    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
