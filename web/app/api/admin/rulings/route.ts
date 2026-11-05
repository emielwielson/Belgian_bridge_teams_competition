import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { activeSeasonMatchIds } from "@/lib/competition/admin-season-scope";
import { rulingFilePath } from "@/lib/files/ruling-file";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const groupId = new URL(request.url).searchParams.get("groupId");
    const matchFilter = await activeSeasonMatchIds(supabase, groupId);

    if (matchFilter.size === 0) return jsonOk({ rulings: [] });

    const { data, error } = await supabase
      .from("rulings")
      .select(
        `
        id,
        match_id,
        board,
        file_path,
        file_name,
        ruling_date,
        created_at,
        updated_at,
        match:matches (
          id,
          round,
          group_id,
          home_team:teams!matches_home_team_id_fkey (name),
          away_team:teams!matches_away_team_id_fkey (name)
        )
      `,
      )
      .in("match_id", [...matchFilter])
      .order("ruling_date", { ascending: false });

    if (error) return jsonError(error.message, 500);

    const rulings = (data ?? []).map((row) => ({
      ...row,
      signed_url: rulingFilePath(row.id, row.file_name, row.file_path),
    }));

    return jsonOk({ rulings });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();

    const matchId = body.match_id as string | undefined;
    const boardRaw = body.board;
    const board =
      boardRaw != null && boardRaw !== "" && Number.isFinite(Number(boardRaw))
        ? Number(boardRaw)
        : null;
    const filePath = body.file_path as string | undefined;
    const fileNameRaw = body.file_name ?? body.fileName;
    const fileName =
      typeof fileNameRaw === "string" && fileNameRaw.trim()
        ? fileNameRaw.trim()
        : null;
    const rulingDate = (body.ruling_date as string | undefined) ?? null;

    if (!matchId || !filePath?.trim()) {
      return jsonErrorCode(ErrorCodes.api.matchIdAndFileRequired, 400);
    }
    if (board != null && (!Number.isInteger(board) || board < 1)) {
      return jsonErrorCode(ErrorCodes.api.boardPositiveInteger, 400);
    }

    const seasonMatches = await activeSeasonMatchIds(supabase);
    if (!seasonMatches.has(matchId)) {
      return jsonErrorCode(ErrorCodes.api.matchNotActiveSeason, 400);
    }

    const { data, error } = await supabase
      .from("rulings")
      .insert({
        match_id: matchId,
        board: board ?? undefined,
        file_path: filePath.trim(),
        file_name: fileName ?? undefined,
        ruling_date: rulingDate ?? undefined,
        created_by: user.id,
      })
      .select("id, match_id, board, file_path, file_name, ruling_date, created_at")
      .single();

    if (error) return jsonError(error.message, 400);

    await supabase.from("match_logs").insert({
      match_id: matchId,
      action: "ruling_created",
      user_id: user.id,
    });

    return jsonOk({ ruling: data }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}
