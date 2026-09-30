import { ARBITER_ACCESS_ROLES, ROLES } from "@/lib/auth/roles";
import {
  assertArbiterInboxApiAccess,
  assertArbiterKindAccess,
  getArbiterAccess,
  groupIdsForCompetitionKind,
  isCompetitionKindCode,
} from "@/lib/auth/arbiter-scope";
import {
  getManagedCompetitionKinds,
  managesKindCode,
  resolveCompetitionKindId,
  type CompetitionKindCode,
} from "@/lib/auth/competition-scope";
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

type AssignableArbiter = {
  userId: string;
  email: string | null;
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

async function callerCanAssignForKind(
  supabase: Awaited<ReturnType<typeof requireRoles>>["supabase"],
  userId: string,
  roles: string[],
  kind: CompetitionKindCode,
): Promise<boolean> {
  if (roles.includes(ROLES.SYSTEM_ADMIN)) return true;
  if (roles.includes(ROLES.COMPETITION_MANAGER)) {
    const managed = await getManagedCompetitionKinds(supabase, userId, roles);
    return managesKindCode(managed, kind);
  }
  const access = await getArbiterAccess(supabase, userId, roles);
  return access.chiefKinds.includes(kind);
}

async function loadAssignableArbiters(
  service: ReturnType<typeof createServiceClient>,
  kind: CompetitionKindCode,
): Promise<AssignableArbiter[]> {
  const kindId = await resolveCompetitionKindId(service, kind);
  const { data: scopeRows, error: scopeError } = await service
    .from("arbiter_competition_scopes")
    .select("user_id")
    .eq("competition_kind_id", kindId);
  if (scopeError) throw scopeError;

  const userIds = [...new Set((scopeRows ?? []).map((r) => r.user_id))];
  if (userIds.length === 0) return [];

  const { data: roleRows, error: roleError } = await service
    .from("user_roles")
    .select("user_id")
    .eq("role", ROLES.ARBITER)
    .in("user_id", userIds);
  if (roleError) throw roleError;

  const arbiters: AssignableArbiter[] = [];
  for (const row of roleRows ?? []) {
    const { data } = await service.auth.admin.getUserById(row.user_id);
    arbiters.push({
      userId: row.user_id,
      email: data.user?.email ?? null,
    });
  }

  arbiters.sort((a, b) =>
    (a.email ?? a.userId).localeCompare(b.email ?? b.userId),
  );
  return arbiters;
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
      return jsonError(
        "kind must be national, flanders, wallonia, or zweiffel",
        400,
      );
    }
    await assertArbiterKindAccess(supabase, user.id, roles, kindParam);

    const groupIds = new Set(
      await groupIdsForCompetitionKind(supabase, kindParam),
    );
    const canAssign = await callerCanAssignForKind(
      supabase,
      user.id,
      roles,
      kindParam,
    );
    const service = createServiceClient();
    const assignableArbiters = canAssign
      ? await loadAssignableArbiters(service, kindParam)
      : [];

    if (groupIds.size === 0) {
      return jsonOk({
        requests: [],
        canAssign,
        assignableArbiters,
      });
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
        assigned_arbiter_id,
        assigned_at,
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

    const scopedRows = (data ?? []).filter((row) => {
      const match = first(row.match as MatchRow | MatchRow[] | null);
      return match != null && groupIds.has(match.group_id);
    });

    const emailByUserId = new Map(
      assignableArbiters.map((a) => [a.userId, a.email] as const),
    );

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

        const assignedArbiterId =
          (row.assigned_arbiter_id as string | null) ?? null;
        let assignedArbiterEmail: string | null = null;
        if (assignedArbiterId) {
          if (emailByUserId.has(assignedArbiterId)) {
            assignedArbiterEmail = emailByUserId.get(assignedArbiterId) ?? null;
          } else {
            const { data: authData } =
              await service.auth.admin.getUserById(assignedArbiterId);
            assignedArbiterEmail = authData.user?.email ?? null;
          }
        }

        return {
          id: row.id,
          match_id: row.match_id,
          description: row.description,
          image_path: row.image_path,
          attachments,
          status: row.status,
          created_at: row.created_at,
          assigned_arbiter_id: assignedArbiterId,
          assigned_at: (row.assigned_at as string | null) ?? null,
          assigned_arbiter_email: assignedArbiterEmail,
          match,
        };
      }),
    );

    return jsonOk({
      requests,
      canAssign,
      assignableArbiters,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
