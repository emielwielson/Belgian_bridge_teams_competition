import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthError } from "./route-auth";
import { ROLES } from "./roles";

export async function getManagedClubIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("club_manager_assignments")
    .select("club_id")
    .eq("user_id", userId);

  if (error) throw error;
  return data?.map((row) => row.club_id) ?? [];
}

export async function assertClubManagerForClub(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  clubId: string,
): Promise<void> {
  if (
    roles.includes(ROLES.SYSTEM_ADMIN) ||
    roles.includes(ROLES.COMPETITION_MANAGER)
  ) {
    return;
  }

  const { data, error } = await supabase
    .from("club_manager_assignments")
    .select("club_id")
    .eq("user_id", userId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new AuthError("Forbidden: not assigned to this club", 403);
  }
}
