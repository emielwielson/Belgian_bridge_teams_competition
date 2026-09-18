import { AuthError } from "@/lib/auth/auth-error";
import { getArbiterAccess, hasArbiterHonorAccess } from "@/lib/auth/arbiter-scope";
import { requireAuth } from "@/lib/auth/route-auth";
import {
  assertCanEditLineup,
  assertCanViewMatchOps,
  loadMatchContext,
} from "@/lib/auth/match-access";
import {
  canViewerSeeTeamLineup,
  honorPermissionsForViewer,
  loadHonorMatchLineupContext,
  resolveHonorViewerSide,
} from "@/lib/competition/honor-lineup-access";
import { revalidatePlayersForMatch } from "@/lib/competition/revalidate-standings";
import { requireActiveSeason } from "@/lib/competition/season";
import {
  getMatchLineup,
  replaceMatchLineup,
  validateHonorSeatingPayload,
  validateLineupPayload,
  type LineupPlayerInput,
  type MatchLineupEntry,
} from "@/lib/scoring/match-operations";
import { jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { matchStatus } from "@/lib/scoring/match-state";
import type { HonorDirection, HonorRoom, HonorSide } from "@/lib/competition/honor-lineup";

type Params = { params: Promise<{ matchId: string }> };

function sideForTeam(
  match: { home_team_id: string; away_team_id: string },
  teamId: string,
): HonorSide | null {
  if (teamId === match.home_team_id) return "home";
  if (teamId === match.away_team_id) return "away";
  return null;
}

function groupLineupByTeam(
  lineup: MatchLineupEntry[],
  homeTeamId: string,
  awayTeamId: string,
) {
  return {
    home: lineup.filter((r) => r.team_id === homeTeamId),
    away: lineup.filter((r) => r.team_id === awayTeamId),
  };
}

function filterLineupVisibility(
  lineup: MatchLineupEntry[],
  match: { home_team_id: string; away_team_id: string },
  canViewHome: boolean,
  canViewAway: boolean,
): MatchLineupEntry[] {
  return lineup.filter((row) => {
    if (row.team_id === match.home_team_id) return canViewHome;
    if (row.team_id === match.away_team_id) return canViewAway;
    return false;
  });
}

function normalizePlayers(players: LineupPlayerInput[]): LineupPlayerInput[] {
  return players.map((p) => {
    const room = (p.room ?? null) as HonorRoom | null;
    const direction = (p.direction ?? null) as HonorDirection | null;
    return {
      player_id: p.player_id,
      is_substitute: Boolean(p.is_substitute),
      room,
      direction,
    };
  });
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase, user, roles } = await requireAuth();
    await assertCanViewMatchOps(supabase, matchId);
    const match = await loadMatchContext(supabase, matchId);
    const lineup = await getMatchLineup(supabase, matchId);
    const honorCtx = await loadHonorMatchLineupContext(supabase, match);

    if (!honorCtx.isHonor) {
      return jsonOk({
        match_id: matchId,
        home_team_id: match.home_team_id,
        away_team_id: match.away_team_id,
        played_at: match.played_at,
        status: matchStatus(match.played_at),
        honor: false,
        lineup: groupLineupByTeam(
          lineup,
          match.home_team_id,
          match.away_team_id,
        ),
      });
    }

    const viewerSide = await resolveHonorViewerSide(
      supabase,
      user.id,
      roles,
      match,
    );
    const arbiterAccess = await getArbiterAccess(supabase, user.id, roles);
    const perms = honorPermissionsForViewer({
      viewerSide,
      phase: honorCtx.phase,
      homeLocked: honorCtx.homeLocked,
      awayLocked: honorCtx.awayLocked,
      played: match.played_at != null,
      roles,
      hasHonorAccess: hasArbiterHonorAccess(arbiterAccess),
    });

    const visible = filterLineupVisibility(
      lineup,
      match,
      perms.canViewHome,
      perms.canViewAway,
    );

    return jsonOk({
      match_id: matchId,
      home_team_id: match.home_team_id,
      away_team_id: match.away_team_id,
      played_at: match.played_at,
      status: matchStatus(match.played_at),
      honor: true,
      phase: honorCtx.phase,
      home_lineup_locked_at: match.home_lineup_locked_at,
      away_lineup_locked_at: match.away_lineup_locked_at,
      venue_tables: honorCtx.venueTables,
      permissions: {
        can_edit_home: perms.canEditHome,
        can_edit_away: perms.canEditAway,
        can_view_home: perms.canViewHome,
        can_view_away: perms.canViewAway,
        can_lock_home: perms.canLockHome,
        can_lock_away: perms.canLockAway,
        can_unlock: perms.canUnlock,
      },
      lineup: groupLineupByTeam(
        visible,
        match.home_team_id,
        match.away_team_id,
      ),
    });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase, user, roles } = await requireAuth();
    const match = await loadMatchContext(supabase, matchId);
    await assertCanEditLineup(supabase, match);

    const body = await request.json();
    const teamId = body.team_id as string | undefined;
    const players = body.players as LineupPlayerInput[] | undefined;

    if (!teamId || !Array.isArray(players)) {
      return jsonErrorCode(ErrorCodes.api.teamAndPlayersRequired, 400);
    }

    const side = sideForTeam(match, teamId);
    if (!side) {
      return jsonErrorCode(ErrorCodes.api.teamIdHomeOrAway, 400);
    }

    const honorCtx = await loadHonorMatchLineupContext(supabase, match);
    if (honorCtx.isHonor) {
      const viewerSide = await resolveHonorViewerSide(
        supabase,
        user.id,
        roles,
        match,
      );
      const perms = honorPermissionsForViewer({
        viewerSide,
        phase: honorCtx.phase,
        homeLocked: honorCtx.homeLocked,
        awayLocked: honorCtx.awayLocked,
        played: match.played_at != null,
      });
      const canEdit = side === "home" ? perms.canEditHome : perms.canEditAway;
      if (!canEdit) {
        throw new AuthError("Forbidden: cannot edit lineup for this match", 403);
      }
    }

    const clubId =
      teamId === match.home_team_id
        ? match.home_team.club_id
        : match.away_team.club_id;
    const season = await requireActiveSeason(supabase);
    const normalized = normalizePlayers(players);

    if (honorCtx.isHonor) {
      validateHonorSeatingPayload(side, normalized);
      await validateLineupPayload(
        supabase,
        teamId,
        clubId,
        season.id,
        normalized,
        { allowPartial: true },
      );
    } else {
      await validateLineupPayload(
        supabase,
        teamId,
        clubId,
        season.id,
        normalized,
      );
    }

    const lineup = await replaceMatchLineup(
      supabase,
      matchId,
      teamId,
      normalized,
    );

    await revalidatePlayersForMatch(supabase, matchId);

    let responseLineup = lineup;
    if (honorCtx.isHonor) {
      const viewerSide = await resolveHonorViewerSide(
        supabase,
        user.id,
        roles,
        match,
      );
      responseLineup = filterLineupVisibility(
        lineup,
        match,
        canViewerSeeTeamLineup({
          viewerSide,
          teamSide: "home",
          phase: honorCtx.phase,
          homeLocked: honorCtx.homeLocked,
          awayLocked: honorCtx.awayLocked,
        }),
        canViewerSeeTeamLineup({
          viewerSide,
          teamSide: "away",
          phase: honorCtx.phase,
          homeLocked: honorCtx.homeLocked,
          awayLocked: honorCtx.awayLocked,
        }),
      );
    }

    return jsonOk({
      match_id: matchId,
      lineup: groupLineupByTeam(
        responseLineup,
        match.home_team_id,
        match.away_team_id,
      ),
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
