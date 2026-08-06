import type { SupabaseClient } from "@supabase/supabase-js";

/** Membership eligibility for competition: active primary only (no season_id). */
export const ACTIVE_PRIMARY = {
  membership_type: "primary",
  status: "active",
} as const;

export async function loadActivePrimaryClubMembers<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  clubId: string,
  select: string,
): Promise<T[]> {
  const { data, error } = await supabase
    .from("player_club_memberships")
    .select(select)
    .eq("club_id", clubId)
    .eq("membership_type", ACTIVE_PRIMARY.membership_type)
    .eq("status", ACTIVE_PRIMARY.status);

  if (error) throw error;
  return (data ?? []) as T[];
}

export async function findActivePrimaryClubMember(
  supabase: SupabaseClient,
  input: { clubId: string; playerId: string },
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("player_club_memberships")
    .select("id")
    .eq("club_id", input.clubId)
    .eq("player_id", input.playerId)
    .eq("membership_type", ACTIVE_PRIMARY.membership_type)
    .eq("status", ACTIVE_PRIMARY.status)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function loadActivePrimaryMembershipsForPlayers<
  T = Record<string, unknown>,
>(
  supabase: SupabaseClient,
  playerIds: string[],
  select: string,
): Promise<T[]> {
  if (playerIds.length === 0) return [];

  const { data, error } = await supabase
    .from("player_club_memberships")
    .select(select)
    .in("player_id", playerIds)
    .eq("membership_type", ACTIVE_PRIMARY.membership_type)
    .eq("status", ACTIVE_PRIMARY.status);

  if (error) throw error;
  return (data ?? []) as T[];
}

export async function loadActivePrimaryPlayerIdsAtClub(
  supabase: SupabaseClient,
  clubId: string,
  playerIds: string[],
): Promise<Set<string>> {
  if (playerIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("player_club_memberships")
    .select("player_id")
    .eq("club_id", clubId)
    .in("player_id", playerIds)
    .eq("membership_type", ACTIVE_PRIMARY.membership_type)
    .eq("status", ACTIVE_PRIMARY.status);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.player_id as string));
}
