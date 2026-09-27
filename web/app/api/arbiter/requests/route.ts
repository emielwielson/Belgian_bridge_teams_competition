import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import {
  assertArbiterInboxApiAccess,
  assertArbiterKindAccess,
  groupIdsForCompetitionKind,
  isCompetitionKindCode,
} from "@/lib/auth/arbiter-scope";
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

type AttachmentRow = {
  storage_path: string;
  sort_order: number;
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

async function signAttachmentPaths(
  service: ReturnType<typeof createServiceClient>,
  paths: { storage_path: string; sort_order: number }[],
): Promise<
  { storage_path: string; signed_url: string | null; sort_order: number }[]
> {
  return Promise.all(
    paths.map(async (att) => {
      let signedUrl: string | null = null;
      try {
        signedUrl = await createOperationalSignedUrl(service, att.storage_path);
      } catch {
        signedUrl = null;
      }
      return {
        storage_path: att.storage_path,
        signed_url: signedUrl,
        sort_order: att.sort_order,
      };
    }),
  );
}

export async function GET(request: Request) {
  try {
    const { user, roles, supabase } = await requireRoles([
      ...ARBITER_ACCESS_ROLES,
    ]);
    await assertArbiterInboxApiAccess(supabase, user.id, roles);

    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "open";
    const kindParam = url.searchParams.get("kind");
    if (!kindParam || !isCompetitionKindCode(kindParam)) {
      return jsonError("kind must be national, flanders, or wallonia", 400);
    }
    await assertArbiterKindAccess(supabase, user.id, roles, kindParam);

    const groupIds = new Set(
      await groupIdsForCompetitionKind(supabase, kindParam),
    );
    if (groupIds.size === 0) {
      return jsonOk({ requests: [] });
    }

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
        attachments:arbiter_request_attachments (
          storage_path,
          sort_order
        ),
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

    const scopedRows = (data ?? []).filter((row) => {
      const match = first(row.match as MatchRow | MatchRow[] | null);
      return match != null && groupIds.has(match.group_id);
    });

    const requests = await Promise.all(
      scopedRows.map(async (row) => {
        const rawAttachments = Array.isArray(row.attachments)
          ? (row.attachments as AttachmentRow[])
          : [];
        const attachmentPaths =
          rawAttachments.length > 0
            ? [...rawAttachments]
                .filter((a) => a.storage_path)
                .sort((a, b) => a.sort_order - b.sort_order)
            : row.image_path
              ? [{ storage_path: row.image_path, sort_order: 0 }]
              : [];

        const attachments = await signAttachmentPaths(service, attachmentPaths);
        const match = await enrichMatchContext(
          supabase,
          first(row.match as MatchRow | MatchRow[] | null),
        );
        return {
          id: row.id,
          match_id: row.match_id,
          description: row.description,
          image_path: row.image_path,
          attachments,
          status: row.status,
          created_at: row.created_at,
          match,
        };
      }),
    );

    return jsonOk({ requests });
  } catch (err) {
    return jsonFromError(err);
  }
}
