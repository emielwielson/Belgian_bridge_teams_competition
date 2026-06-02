import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

type Params = { params: Promise<{ warningId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { warningId } = await params;
    const { user, supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();

    const updates: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (body.warning_date != null) updates.warning_date = body.warning_date;
    if (body.reason != null) updates.reason = String(body.reason).trim();
    if (body.team_id != null) updates.team_id = body.team_id;

    const { data, error } = await supabase
      .from("warnings")
      .update(updates)
      .eq("id", warningId)
      .select("id, team_id, warning_date, reason, updated_at")
      .single();

    if (error) return jsonError(error.message, 400);
    if (!data) return jsonErrorCode(ErrorCodes.api.warningNotFound, 404);

    return jsonOk({ warning: data });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { warningId } = await params;
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);

    const { error } = await supabase.from("warnings").delete().eq("id", warningId);

    if (error) return jsonError(error.message, 400);

    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
