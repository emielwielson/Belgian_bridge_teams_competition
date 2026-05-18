import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const regionId = new URL(request.url).searchParams.get("regionId");

    let query = supabase
      .from("clubs")
      .select("id, name, region_id, region:regions(code, name)")
      .order("name");

    if (regionId) {
      query = query.eq("region_id", regionId);
    }

    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    return jsonOk({ clubs: data ?? [] });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();

    const { data, error } = await supabase
      .from("clubs")
      .insert({ name: body.name, region_id: body.region_id })
      .select()
      .single();

    if (error) return jsonError(error.message, 400);
    return jsonOk({ club: data }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}
