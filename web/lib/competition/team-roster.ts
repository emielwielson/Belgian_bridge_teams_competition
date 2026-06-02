import type { SupabaseClient } from "@supabase/supabase-js";
import { TeamValidationError } from "@/lib/competition/team-captain";
import { getActiveSeason, requireActiveSeason } from "@/lib/competition/season";

export type RosterPlayer = {
  player_id: string;
  name: string;
  member_number: string | null;
};

export type TeamRosterState = {
  roster: RosterPlayer[];
  available_players: RosterPlayer[];
  roster_editable: boolean;
};

function unwrapOne<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

export async function loadTeamRosterState(
  supabase: SupabaseClient,
  teamId: string,
  clubId: string,
): Promise<TeamRosterState> {
  const season = await getActiveSeason(supabase);
  const roster_editable = season?.status === "setup";
  let roster: RosterPlayer[] = [];
  let available_players: RosterPlayer[] = [];

  if (season) {
    const { data: rosterRows, error: rosterError } = await supabase
      .from("team_players")
      .select("player_id, player:players(id, name, member_number)")
      .eq("team_id", teamId)
      .eq("season_id", season.id);

    if (rosterError) throw rosterError;

    roster = (rosterRows ?? [])
      .map((r) => {
        const p = unwrapOne<{
          id: string;
          name: string;
          member_number: string | null;
        }>(r.player);
        if (!p) return null;
        return {
          player_id: p.id,
          name: p.name,
          member_number: p.member_number,
        };
      })
      .filter((p): p is RosterPlayer => p != null)
      .sort((a, b) => a.name.localeCompare(b.name));

    const { data: memberships, error: membershipsError } = await supabase
      .from("player_club_memberships")
      .select("player_id, player:players(id, name, member_number)")
      .eq("club_id", clubId)
      .eq("season_id", season.id);

    if (membershipsError) throw membershipsError;

    const { data: clubTeams, error: clubTeamsError } = await supabase
      .from("teams")
      .select("id")
      .eq("club_id", clubId);

    if (clubTeamsError) throw clubTeamsError;

    const clubTeamIds = clubTeams?.map((t) => t.id) ?? [];
    const assignedPlayerIds = new Set<string>();

    if (clubTeamIds.length > 0) {
      const { data: clubAssignments, error: assignmentsError } = await supabase
        .from("team_players")
        .select("player_id")
        .in("team_id", clubTeamIds)
        .eq("season_id", season.id);

      if (assignmentsError) throw assignmentsError;

      for (const row of clubAssignments ?? []) {
        assignedPlayerIds.add(row.player_id);
      }
    }

    const onRoster = new Set(roster.map((r) => r.player_id));

    for (const m of memberships ?? []) {
      const p = unwrapOne<{
        id: string;
        name: string;
        member_number: string | null;
      }>(m.player);
      if (!p || onRoster.has(p.id) || assignedPlayerIds.has(p.id)) continue;

      available_players.push({
        player_id: p.id,
        name: p.name,
        member_number: p.member_number,
      });
    }

    available_players.sort((a, b) => a.name.localeCompare(b.name));
  }

  return { roster, available_players, roster_editable };
}

export async function addPlayerToTeamRoster(
  supabase: SupabaseClient,
  params: { teamId: string; playerId: string; seasonId: string },
): Promise<void> {
  const { error } = await supabase.from("team_players").insert({
    team_id: params.teamId,
    player_id: params.playerId,
    season_id: params.seasonId,
  });

  if (error) throw error;
}

/** Captains must be on the team roster (My team, lineup, roster management). */
export async function ensureCaptainOnTeamRoster(
  supabase: SupabaseClient,
  params: { teamId: string; captainId: string; seasonId: string },
): Promise<void> {
  const { data: onThisTeam, error: onTeamError } = await supabase
    .from("team_players")
    .select("team_id")
    .eq("team_id", params.teamId)
    .eq("player_id", params.captainId)
    .eq("season_id", params.seasonId)
    .maybeSingle();

  if (onTeamError) throw onTeamError;
  if (onThisTeam) return;

  const { data: elsewhere, error: elsewhereError } = await supabase
    .from("team_players")
    .select("team_id")
    .eq("player_id", params.captainId)
    .eq("season_id", params.seasonId)
    .maybeSingle();

  if (elsewhereError) throw elsewhereError;
  if (elsewhere) {
    throw new TeamValidationError(
      "Captain is already on another team this season; remove them from that roster first",
    );
  }

  await addPlayerToTeamRoster(supabase, {
    teamId: params.teamId,
    playerId: params.captainId,
    seasonId: params.seasonId,
  });
}

export async function removePlayerFromTeamRoster(
  supabase: SupabaseClient,
  params: { teamId: string; playerId: string; seasonId: string },
): Promise<void> {
  const { error } = await supabase
    .from("team_players")
    .delete()
    .eq("team_id", params.teamId)
    .eq("player_id", params.playerId)
    .eq("season_id", params.seasonId);

  if (error) throw error;
}
