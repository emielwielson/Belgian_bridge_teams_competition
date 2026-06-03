import { requireAuth } from "@/lib/auth/route-auth";
import { assertCanManageTeamRoster } from "@/lib/auth/team-access";
import { requireActiveSeason } from "@/lib/competition/season";
import { assertTeamRosterEditable } from "@/lib/competition/league-roster-lock";
import {
  addPlayerToTeamRoster,
  loadTeamRosterState,
  removePlayerFromTeamRoster,
} from "@/lib/competition/team-roster";
import { jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

type TeamParams = { params: Promise<{ teamId: string }> };

async function loadTeamClubId(
  supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"],
  teamId: string,
): Promise<{ clubId: string } | null> {
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, club_id")
    .eq("id", teamId)
    .maybeSingle();

  if (error) throw error;
  if (!team) return null;
  return { clubId: team.club_id };
}

export async function GET(_request: Request, { params }: TeamParams) {
  try {
    const { teamId } = await params;
    const { user, roles, supabase } = await requireAuth();

    const teamRef = await loadTeamClubId(supabase, teamId);
    if (!teamRef) return jsonErrorCode(ErrorCodes.api.teamNotFound, 404);

    await assertCanManageTeamRoster(
      supabase,
      user.id,
      roles,
      teamId,
      teamRef.clubId,
    );

    const state = await loadTeamRosterState(supabase, teamId, teamRef.clubId);
    return jsonOk(state);
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request, { params }: TeamParams) {
  try {
    const { teamId } = await params;
    const { user, roles, supabase } = await requireAuth();

    const teamRef = await loadTeamClubId(supabase, teamId);
    if (!teamRef) return jsonErrorCode(ErrorCodes.api.teamNotFound, 404);

    await assertCanManageTeamRoster(
      supabase,
      user.id,
      roles,
      teamId,
      teamRef.clubId,
    );

    const season = await requireActiveSeason(supabase);
    await assertTeamRosterEditable(supabase, teamId);

    const body = await request.json();
    const playerId = body.player_id as string | undefined;
    if (!playerId) return jsonErrorCode(ErrorCodes.api.playerIdRequired, 400);

    if (body.action === "roster_remove") {
      await removePlayerFromTeamRoster(supabase, {
        teamId,
        playerId,
        seasonId: season.id,
      });
      return jsonOk({ removed: true });
    }

    const { data: membership } = await supabase
      .from("player_club_memberships")
      .select("id")
      .eq("club_id", teamRef.clubId)
      .eq("player_id", playerId)
      .eq("season_id", season.id)
      .maybeSingle();

    if (!membership) {
      return jsonErrorCode(ErrorCodes.api.playerNotClubMember, 403);
    }

    await addPlayerToTeamRoster(supabase, {
      teamId,
      playerId,
      seasonId: season.id,
    });

    return jsonOk({ added: true }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}
