import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { createOperationalSignedUrl } from "@/lib/files/operational-file-storage";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { createServiceClient } from "@/lib/supabase/server-client";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    const status = new URL(request.url).searchParams.get("status") ?? "open";

    let query = supabase
      .from("arbiter_requests")
      .select(
        `
        id,
        match_id,
        board,
        description,
        image_path,
        status,
        created_at,
        match:matches (
          round,
          datetime,
          group_id,
          home_team:teams!matches_home_team_id_fkey (name),
          away_team:teams!matches_away_team_id_fkey (name)
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);

    const service = createServiceClient();
    const requests = await Promise.all(
      (data ?? []).map(async (row) => {
        let imageSignedUrl: string | null = null;
        if (row.image_path) {
          try {
            imageSignedUrl = await createOperationalSignedUrl(
              service,
              row.image_path,
            );
          } catch {
            imageSignedUrl = null;
          }
        }
        return { ...row, image_signed_url: imageSignedUrl };
      }),
    );

    return jsonOk({ requests });
  } catch (err) {
    return jsonFromError(err);
  }
}
