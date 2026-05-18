import { requireAuth } from "@/lib/auth/route-auth";
import { assertClubManagerForClub } from "@/lib/auth/user-access";
import { ROLES } from "@/lib/auth/roles";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ clubId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { clubId } = await params;
    const { user, roles, supabase } = await requireAuth();
    await assertClubManagerForClub(supabase, user.id, roles, clubId);

    const { data, error } = await supabase
      .from("clubs")
      .select("id, name, location, region_id, region:regions(code, name)")
      .eq("id", clubId)
      .single();

    if (error) return jsonError(error.message, 404);
    return jsonOk({ club: data });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { clubId } = await params;
    const { user, roles, supabase } = await requireAuth();
    await assertClubManagerForClub(supabase, user.id, roles, clubId);

    const canManage =
      roles.includes(ROLES.SYSTEM_ADMIN) ||
      roles.includes(ROLES.COMPETITION_MANAGER) ||
      roles.includes(ROLES.CLUB_MANAGER);

    if (!canManage) {
      return jsonError("Forbidden", 403);
    }

    const body = await request.json();
    const patch: { name?: string; location?: string | null } = {};
    if (body.name !== undefined) {
      patch.name = String(body.name);
    }
    if ("location" in body) {
      patch.location =
        body.location === "" || body.location == null
          ? null
          : String(body.location);
    }
    if (Object.keys(patch).length === 0) {
      return jsonError("No fields to update", 400);
    }

    const { error } = await supabase
      .from("clubs")
      .update(patch)
      .eq("id", clubId);

    if (error) return jsonError(error.message, 400);
    return jsonOk({ updated: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
