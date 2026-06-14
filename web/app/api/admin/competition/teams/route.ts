import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { assertNationalGroupCanAddTeam } from "@/lib/competition/national-teams";
import { requireActiveSeason } from "@/lib/competition/season";
import { teamLocationFromClub } from "@/lib/competition/team-location";
import {
  assertCaptainIsClubMember,
  parseCaptainId,
  validateTeamCreateBody,
} from "@/lib/competition/team-captain";
import { ensureCaptainOnTeamRoster } from "@/lib/competition/team-roster";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

function unwrapCaptain(raw: unknown): { id: string; name: string; member_number: string | null } | null {
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const p = row as { id: string; name: string; member_number: string | null };
  return p.id ? p : null;
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const groupId = new URL(request.url).searchParams.get("groupId");
    if (!groupId) return jsonErrorCode(ErrorCodes.api.groupIdRequired, 400);

    const { data: teams, error } = await supabase
      .from("teams")
      .select(
        "id, name, club_id, captain_id, club:clubs(id, name, region_id, location), captain:players(id, name, member_number)",
      )
      .eq("group_id", groupId)
      .order("name");

    if (error) return jsonError(error.message, 500);

    const teamIds = teams?.map((t) => t.id) ?? [];
    let rosters: Record<string, { player_id: string; player: { name: string } }[]> =
      {};

    if (teamIds.length > 0) {
      const season = await requireActiveSeason(supabase);
      const { data: players } = await supabase
        .from("team_players")
        .select("team_id, player_id, player:players(id, name)")
        .in("team_id", teamIds)
        .eq("season_id", season.id);

      for (const row of players ?? []) {
        const list = rosters[row.team_id] ?? [];
        const raw = row.player as unknown;
        const player = Array.isArray(raw)
          ? (raw[0] as { name: string } | undefined)
          : (raw as { name: string } | null);
        list.push({
          player_id: row.player_id,
          player: player ? { name: player.name } : { name: "Unknown" },
        });
        rosters[row.team_id] = list;
      }
    }

    return jsonOk({
      teams: (teams ?? []).map((t) => {
        const rawClub = t.club as unknown;
        const club = Array.isArray(rawClub)
          ? (rawClub[0] as { location?: string | null } | undefined)
          : (rawClub as { location?: string | null } | null);
        const { club: _club, captain: _captain, ...rest } = t;
        return {
          ...rest,
          location: teamLocationFromClub(club),
          captain: unwrapCaptain(t.captain),
          roster: rosters[t.id] ?? [],
        };
      }),
    });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();

    if (body.action === "roster_add") {
      const season = await requireActiveSeason(supabase);
      const { error } = await supabase.from("team_players").insert({
        team_id: body.team_id,
        player_id: body.player_id,
        season_id: season.id,
      });
      if (error) return jsonError(error.message, 400);
      return jsonOk({ added: true }, { status: 201 });
    }

    if (body.action === "roster_remove") {
      const season = await requireActiveSeason(supabase);
      const { error } = await supabase
        .from("team_players")
        .delete()
        .eq("team_id", body.team_id)
        .eq("player_id", body.player_id)
        .eq("season_id", season.id);
      if (error) return jsonError(error.message, 400);
      return jsonOk({ removed: true });
    }

    const season = await requireActiveSeason(supabase);
    const createInput = validateTeamCreateBody(body);

    try {
      await assertNationalGroupCanAddTeam(supabase, createInput.group_id);
    } catch (err) {
      return jsonFromError(err);
    }

    await assertCaptainIsClubMember(supabase, {
      clubId: createInput.club_id,
      playerId: createInput.captain_id,
      seasonId: season.id,
    });

    const { data, error } = await supabase
      .from("teams")
      .insert({
        group_id: createInput.group_id,
        club_id: createInput.club_id,
        name: createInput.name,
        captain_id: createInput.captain_id,
      })
      .select()
      .single();

    if (error) return jsonError(error.message, 400);

    await ensureCaptainOnTeamRoster(supabase, {
      teamId: data.id,
      captainId: createInput.captain_id,
      seasonId: season.id,
    });

    await supabase.rpc("sync_group_round_count", {
      p_group_id: createInput.group_id,
    });

    return jsonOk({ team: data }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();
    const teamId = typeof body.id === "string" ? body.id : "";
    if (!teamId) return jsonErrorCode(ErrorCodes.api.idRequired, 400);

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, club_id")
      .eq("id", teamId)
      .maybeSingle();

    if (teamError) return jsonError(teamError.message, 500);
    if (!team) return jsonErrorCode(ErrorCodes.api.teamNotFound, 404);

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return jsonErrorCode(ErrorCodes.api.teamNameRequired, 400);
      patch.name = name;
    }

    const captainId = parseCaptainId(body);
    let rosterCaptainId: string | undefined;
    if (captainId !== undefined) {
      if (captainId === null) {
        return jsonErrorCode(ErrorCodes.api.captainIdRequired, 400);
      }
      const season = await requireActiveSeason(supabase);
      await assertCaptainIsClubMember(supabase, {
        clubId: team.club_id,
        playerId: captainId,
        seasonId: season.id,
      });
      patch.captain_id = captainId;
      rosterCaptainId = captainId;
    }

    if (Object.keys(patch).length === 0) {
      return jsonErrorCode(ErrorCodes.api.noFieldsToUpdate, 400);
    }

    const { error } = await supabase.from("teams").update(patch).eq("id", teamId);

    if (error) return jsonError(error.message, 400);

    if (rosterCaptainId) {
      const season = await requireActiveSeason(supabase);
      await ensureCaptainOnTeamRoster(supabase, {
        teamId,
        captainId: rosterCaptainId,
        seasonId: season.id,
      });
    }

    return jsonOk({ updated: true });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();
    const teamId = body.id as string | undefined;
    if (!teamId) return jsonErrorCode(ErrorCodes.api.idRequired, 400);

    const { data: team } = await supabase
      .from("teams")
      .select("group_id")
      .eq("id", teamId)
      .maybeSingle();

    const [{ count: homeCount }, { count: awayCount }] = await Promise.all([
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("home_team_id", teamId),
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("away_team_id", teamId),
    ]);
    const matchCount = (homeCount ?? 0) + (awayCount ?? 0);

    if ((matchCount ?? 0) > 0) {
      return jsonErrorCode(ErrorCodes.api.cannotDeleteTeamWithMatches, 409);
    }

    const { error } = await supabase.from("teams").delete().eq("id", teamId);
    if (error) return jsonError(error.message, 400);

    if (team?.group_id) {
      await supabase.rpc("sync_group_round_count", {
        p_group_id: team.group_id,
      });
    }

    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
