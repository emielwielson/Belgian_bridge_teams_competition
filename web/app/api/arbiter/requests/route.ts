import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import type { InboxMatchContext } from "@/lib/competition/arbiter-request";
import { loadGroupScoringContext } from "@/lib/competition/match-scoring-context";
import { createOperationalSignedUrl } from "@/lib/files/operational-file-storage";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { allowsBoardChoice } from "@/lib/scoring/board-count-rules";
import { createServiceClient } from "@/lib/supabase/server-client";

type MatchRow = {
  round: number;
  datetime: string;
  group_id: string;
  home_team_id: string;
  away_team_id: string;
  imps_home: number | null;
  imps_away: number | null;
  vp_home: number | null;
  vp_away: number | null;
  played_at: string | null;
  mis_seating: boolean;
  vp_board_count: number | null;
  selected_board_count: number | null;
  board_count: number;
  home_team: { id: string; name: string } | { id: string; name: string }[] | null;
  away_team: { id: string; name: string } | { id: string; name: string }[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function enrichMatchContext(
  supabase: Awaited<ReturnType<typeof requireRoles>>["supabase"],
  match: MatchRow | null,
): Promise<InboxMatchContext | null> {
  if (!match) return null;

  const scoringContext = await loadGroupScoringContext(supabase, match.group_id);

  return {
    round: match.round,
    datetime: match.datetime,
    group_id: match.group_id,
    home_team_id: match.home_team_id,
    away_team_id: match.away_team_id,
    imps_home: match.imps_home,
    imps_away: match.imps_away,
    vp_home: match.vp_home,
    vp_away: match.vp_away,
    played_at: match.played_at,
    mis_seating: match.mis_seating ?? false,
    vp_board_count: match.vp_board_count,
    selected_board_count: match.selected_board_count,
    board_count: match.board_count,
    home_team: first(match.home_team),
    away_team: first(match.away_team),
    allows_board_choice: allowsBoardChoice(scoringContext),
  };
}

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
        description,
        image_path,
        status,
        created_at,
        match:matches (
          round,
          datetime,
          group_id,
          home_team_id,
          away_team_id,
          imps_home,
          imps_away,
          vp_home,
          vp_away,
          played_at,
          mis_seating,
          vp_board_count,
          selected_board_count,
          board_count,
          home_team:teams!matches_home_team_id_fkey (id, name),
          away_team:teams!matches_away_team_id_fkey (id, name)
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
        const match = await enrichMatchContext(
          supabase,
          first(row.match as MatchRow | MatchRow[] | null),
        );
        return {
          id: row.id,
          match_id: row.match_id,
          description: row.description,
          image_path: row.image_path,
          status: row.status,
          created_at: row.created_at,
          image_signed_url: imageSignedUrl,
          match,
        };
      }),
    );

    return jsonOk({ requests });
  } catch (err) {
    return jsonFromError(err);
  }
}
