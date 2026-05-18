import type { SupabaseClient } from "@supabase/supabase-js";
import { NATIONAL_LEAGUE_NAME } from "./national-structure";

export const NATIONAL_TEAMS_PER_GROUP = 8;

export async function isNationalGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<boolean> {
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("division_id")
    .eq("id", groupId)
    .maybeSingle();
  if (groupError || !group?.division_id) return false;

  const { data: division, error: divisionError } = await supabase
    .from("divisions")
    .select("league_id")
    .eq("id", group.division_id)
    .maybeSingle();
  if (divisionError || !division?.league_id) return false;

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("scope, name")
    .eq("id", division.league_id)
    .maybeSingle();
  if (leagueError || !league) return false;

  return league.scope === "national" && league.name === NATIONAL_LEAGUE_NAME;
}

export async function assertNationalGroupCanAddTeam(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  if (!(await isNationalGroup(supabase, groupId))) return;

  const { count, error } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);

  if (error) throw error;
  if ((count ?? 0) >= NATIONAL_TEAMS_PER_GROUP) {
    throw new Error(
      `National groups allow exactly ${NATIONAL_TEAMS_PER_GROUP} teams`,
    );
  }
}
