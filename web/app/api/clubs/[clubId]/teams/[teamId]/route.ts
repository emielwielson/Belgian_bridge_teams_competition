import { requireAuth } from "@/lib/auth/route-auth";
import { assertClubManagerForClub } from "@/lib/auth/user-access";
import { loadClubTeamDetail } from "@/lib/competition/club-manager-queries";
import { requireActiveSeason } from "@/lib/competition/season";
import { requireSeasonInSetup } from "@/lib/competition/season-setup";
import {
  addPlayerToTeamRoster,
  ensureCaptainOnTeamRoster,
  removePlayerFromTeamRoster,
} from "@/lib/competition/team-roster";
import {
  assertCaptainIsClubMember,
  parseCaptainId,
} from "@/lib/competition/team-captain";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

type Params = { params: Promise<{ clubId: string; teamId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { clubId, teamId } = await params;
    const { user, roles, supabase } = await requireAuth();
    await assertClubManagerForClub(supabase, user.id, roles, clubId);

    const detail = await loadClubTeamDetail(supabase, clubId, teamId);
    if (!detail) return jsonErrorCode(ErrorCodes.api.teamNotFound, 404);

    return jsonOk(detail);
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { clubId, teamId } = await params;
    const { user, roles, supabase } = await requireAuth();
    await assertClubManagerForClub(supabase, user.id, roles, clubId);

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, club_id")
      .eq("id", teamId)
      .maybeSingle();

    if (teamError) return jsonError(teamError.message, 500);
    if (!team || team.club_id !== clubId) {
      return jsonErrorCode(ErrorCodes.api.teamNotFound, 404);
    }

    const body = await request.json();
    const updates: { captain_id?: string | null } = {};

    const captainId = parseCaptainId(body);
    if (captainId !== undefined) {
      if (captainId === null) {
        updates.captain_id = null;
      } else {
        const season = await requireActiveSeason(supabase);
        await assertCaptainIsClubMember(supabase, {
          clubId,
          playerId: captainId,
          seasonId: season.id,
        });
        updates.captain_id = captainId;
      }
    }

    if (Object.keys(updates).length === 0) {
      return jsonErrorCode(ErrorCodes.api.noFieldsToUpdate, 400);
    }

    const { error } = await supabase
      .from("teams")
      .update(updates)
      .eq("id", teamId)
      .eq("club_id", clubId);

    if (error) return jsonError(error.message, 400);

    if (updates.captain_id) {
      const season = await requireActiveSeason(supabase);
      await ensureCaptainOnTeamRoster(supabase, {
        teamId,
        captainId: updates.captain_id,
        seasonId: season.id,
      });
    }

    return jsonOk({ updated: true });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { clubId, teamId } = await params;
    const { user, roles, supabase } = await requireAuth();
    await assertClubManagerForClub(supabase, user.id, roles, clubId);

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, club_id")
      .eq("id", teamId)
      .maybeSingle();

    if (teamError) return jsonError(teamError.message, 500);
    if (!team || team.club_id !== clubId) {
      return jsonErrorCode(ErrorCodes.api.teamNotFound, 404);
    }

    const season = await requireActiveSeason(supabase);
    requireSeasonInSetup(season);

    const body = await request.json();
    const playerId = body.player_id as string | undefined;
    if (!playerId) return jsonErrorCode(ErrorCodes.api.playerIdRequired, 400);

    const { data: membership } = await supabase
      .from("player_club_memberships")
      .select("id")
      .eq("club_id", clubId)
      .eq("player_id", playerId)
      .eq("season_id", season.id)
      .maybeSingle();

    if (!membership) {
      return jsonErrorCode(ErrorCodes.api.playerNotClubMember, 403);
    }

    if (body.action === "roster_remove") {
      await removePlayerFromTeamRoster(supabase, {
        teamId,
        playerId,
        seasonId: season.id,
      });
      return jsonOk({ removed: true });
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
