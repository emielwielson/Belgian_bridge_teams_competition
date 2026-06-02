import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import {
  activeSeasonTeamIds,
  parsePenaltyInput,
  teamIdsForGroupFilter,
} from "@/lib/competition/penalties";
import { revalidateStandingsForTeam } from "@/lib/competition/revalidate-standings";
import { createOperationalSignedUrl } from "@/lib/files/operational-file-storage";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createServiceClient } from "@/lib/supabase/server-client";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    const groupId = new URL(request.url).searchParams.get("groupId");
    const seasonTeamIds = await activeSeasonTeamIds(supabase);
    const teamFilter = await teamIdsForGroupFilter(
      supabase,
      groupId,
      seasonTeamIds,
    );

    if (teamFilter.size === 0) return jsonOk({ penalties: [] });

    const { data, error } = await supabase
      .from("penalties")
      .select(
        `
        id,
        team_id,
        penalty_date,
        reason,
        vp_deduction,
        file_path,
        created_at,
        updated_at,
        team:teams (id, name, group_id)
      `,
      )
      .in("team_id", [...teamFilter])
      .order("penalty_date", { ascending: false });

    if (error) return jsonError(error.message, 500);

    const service = createServiceClient();
    const penalties = await Promise.all(
      (data ?? []).map(async (row) => {
        let file_signed_url: string | null = null;
        if (row.file_path) {
          try {
            file_signed_url = await createOperationalSignedUrl(
              service,
              row.file_path,
            );
          } catch {
            file_signed_url = null;
          }
        }
        return { ...row, file_signed_url };
      }),
    );

    return jsonOk({ penalties });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    const body = await request.json();
    const parsed = parsePenaltyInput(body);
    if ("error" in parsed) return jsonErrorCode(parsed.error, 400);

    const { data, error } = await supabase
      .from("penalties")
      .insert({
        team_id: parsed.teamId,
        penalty_date: parsed.penaltyDate,
        reason: parsed.reason,
        vp_deduction: parsed.vpDeduction,
        file_path: parsed.filePath,
        created_by: user.id,
      })
      .select(
        "id, team_id, penalty_date, reason, vp_deduction, file_path, created_at",
      )
      .single();

    if (error) return jsonError(error.message, 400);

    await revalidateStandingsForTeam(supabase, parsed.teamId);

    return jsonOk({ penalty: data }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}
