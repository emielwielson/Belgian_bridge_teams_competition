import type { SupabaseClient } from "@supabase/supabase-js";
import { loadGroupScoringContext } from "@/lib/competition/match-scoring-context";
import { loadTeamsForUser } from "@/lib/competition/team-queries";
import { isHonorDivision } from "@/lib/scoring/board-count-rules";
import { AuthError } from "./auth-error";
import { ROLES } from "./roles";

export async function isCaptainOfTeam(
  supabase: SupabaseClient,
  teamId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("current_user_is_captain_of_team", {
    p_team_id: teamId,
  });
  if (error) throw error;
  return Boolean(data);
}

/** True when the user's active player is captain of at least one team in the active season. */
export async function isCaptainOfAnyTeam(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const teams = await loadTeamsForUser(supabase, userId);
  for (const team of teams) {
    if (await isCaptainOfTeam(supabase, team.id)) {
      return true;
    }
  }
  return false;
}

/**
 * True when the user's active player is on a national Honor Division team
 * in the active season (excludes regional Liga).
 *
 * Reuses loadTeamsForUser (same source as "My team"), then checks each team's
 * group with the same national+honor rule as match UI.
 */
export async function isPlayerOnHonorTeam(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const teams = await loadTeamsForUser(supabase, userId);
  if (teams.length === 0) return false;

  const { data, error } = await supabase
    .from("teams")
    .select("group_id")
    .in(
      "id",
      teams.map((team) => team.id),
    );

  if (error) throw error;

  const groupIds = new Set<string>();
  for (const row of data ?? []) {
    if (typeof row.group_id === "string") groupIds.add(row.group_id);
  }

  for (const groupId of groupIds) {
    const scoring = await loadGroupScoringContext(supabase, groupId);
    if (isHonorDivision(scoring)) return true;
  }
  return false;
}

export async function canManageTeamRoster(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  teamId: string,
  clubId: string,
): Promise<boolean> {
  if (roles.includes(ROLES.SYSTEM_ADMIN)) {
    return true;
  }
  if (roles.includes(ROLES.COMPETITION_MANAGER)) {
    const { data, error } = await supabase.rpc("current_user_manages_team", {
      p_team_id: teamId,
    });
    if (error) throw error;
    return Boolean(data);
  }

  return isCaptainOfTeam(supabase, teamId);
}

/** Same access as roster: competition managers and the team captain. */
export async function canManageTeamLocation(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  teamId: string,
  clubId: string,
): Promise<boolean> {
  return canManageTeamRoster(supabase, userId, roles, teamId, clubId);
}

export async function assertCanManageTeamRoster(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  teamId: string,
  clubId: string,
): Promise<void> {
  if (!(await canManageTeamRoster(supabase, userId, roles, teamId, clubId))) {
    throw new AuthError("Forbidden: cannot manage roster for this team", 403);
  }
}

export async function assertCanManageTeamLocation(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  teamId: string,
  clubId: string,
): Promise<void> {
  if (!(await canManageTeamLocation(supabase, userId, roles, teamId, clubId))) {
    throw new AuthError("Forbidden: cannot manage location for this team", 403);
  }
}

export async function canManageTeamConventionCards(
  supabase: SupabaseClient,
  teamId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "current_user_can_manage_team_convention_cards",
    { p_team_id: teamId },
  );
  if (error) throw error;
  return Boolean(data);
}

export async function assertCanManageTeamConventionCards(
  supabase: SupabaseClient,
  teamId: string,
): Promise<void> {
  if (!(await canManageTeamConventionCards(supabase, teamId))) {
    throw new AuthError(
      "Forbidden: cannot manage convention cards for this team",
      403,
    );
  }
}
