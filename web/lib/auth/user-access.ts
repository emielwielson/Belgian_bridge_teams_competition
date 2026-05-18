import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthError } from "./route-auth";
import { ROLES } from "./roles";

export type ManagedClubSummary = {
  id: string;
  name: string;
};

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

export async function loadManagedClubsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ManagedClubSummary[]> {
  const clubIds = await getManagedClubIds(supabase, userId);
  if (clubIds.length === 0) return [];

  const { data, error } = await supabase
    .from("clubs")
    .select("id, name")
    .in("id", clubIds)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export function isClubManagerPath(pathname: string): boolean {
  return pathname === "/club-manager" || pathname.startsWith("/club-manager/");
}

/** Matches API rules: admins, or a row in club_manager_assignments for the club. */
export async function canAccessClubManagerRoute(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  pathname: string,
): Promise<boolean> {
  if (
    roles.includes(ROLES.SYSTEM_ADMIN) ||
    roles.includes(ROLES.COMPETITION_MANAGER)
  ) {
    return true;
  }

  const clubIds = await getManagedClubIds(supabase, userId);
  const clubPageMatch = pathname.match(/^\/club-manager\/([^/]+)$/);
  if (clubPageMatch) {
    return clubIds.includes(clubPageMatch[1]);
  }
  if (pathname === "/club-manager") {
    return clubIds.length > 0;
  }
  return false;
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
