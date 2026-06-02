import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLES } from "./roles";
import { AuthError } from "./route-auth";
import { getManagedClubIds } from "./user-access";

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

export async function canManageTeamRoster(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  teamId: string,
  clubId: string,
): Promise<boolean> {
  if (
    roles.includes(ROLES.SYSTEM_ADMIN) ||
    roles.includes(ROLES.COMPETITION_MANAGER)
  ) {
    return true;
  }

  const managedClubIds = await getManagedClubIds(supabase, userId);
  if (managedClubIds.includes(clubId)) {
    return true;
  }

  return isCaptainOfTeam(supabase, teamId);
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
