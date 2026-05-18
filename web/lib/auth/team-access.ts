import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthError } from "./route-auth";

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
