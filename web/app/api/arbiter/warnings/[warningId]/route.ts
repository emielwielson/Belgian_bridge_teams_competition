import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { assertCanDisciplineTeam } from "@/lib/auth/match-access";
import { revalidateStandingsForTeam } from "@/lib/competition/revalidate-standings";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

type Params = { params: Promise<{ warningId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { warningId } = await params;
    const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    const body = await request.json();

    const { data: existing, error: loadError } = await supabase
      .from("warnings")
      .select("team_id")
      .eq("id", warningId)
      .maybeSingle();

    if (loadError) return jsonError(loadError.message, 500);
    if (!existing) return jsonErrorCode(ErrorCodes.api.warningNotFound, 404);

    await assertCanDisciplineTeam(supabase, roles, existing.team_id);

    const updates: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (body.warning_date != null) updates.warning_date = body.warning_date;
    if (body.reason != null) updates.reason = String(body.reason).trim();
    if (body.team_id != null) {
      const newTeamId = String(body.team_id);
      if (newTeamId !== existing.team_id) {
        await assertCanDisciplineTeam(supabase, roles, newTeamId);
      }
      updates.team_id = newTeamId;
    }

    const { data, error } = await supabase
      .from("warnings")
      .update(updates)
      .eq("id", warningId)
      .select(
        "id, team_id, warning_date, reason, created_by, created_by_name, updated_at, updated_by_name",
      )
      .single();

    if (error) return jsonError(error.message, 400);
    if (!data) return jsonErrorCode(ErrorCodes.api.warningNotFound, 404);

    await revalidateStandingsForTeam(supabase, data.team_id);
    if (data.team_id !== existing.team_id) {
      await revalidateStandingsForTeam(supabase, existing.team_id);
    }

    return jsonOk({ warning: data });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { warningId } = await params;
    const { roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);

    const { data: existing, error: loadError } = await supabase
      .from("warnings")
      .select("team_id")
      .eq("id", warningId)
      .maybeSingle();

    if (loadError) return jsonError(loadError.message, 500);
    if (!existing) return jsonErrorCode(ErrorCodes.api.warningNotFound, 404);

    await assertCanDisciplineTeam(supabase, roles, existing.team_id);

    const { error } = await supabase
      .from("warnings")
      .delete()
      .eq("id", warningId);

    if (error) return jsonError(error.message, 400);

    await revalidateStandingsForTeam(supabase, existing.team_id);

    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
