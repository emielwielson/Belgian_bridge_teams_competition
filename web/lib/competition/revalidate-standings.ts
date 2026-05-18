import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function revalidateStandingsForGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  revalidatePath("/standings");
  revalidatePath(`/standings/group/${groupId}`);

  const { data: group } = await supabase
    .from("groups")
    .select(
      `
      id,
      division:divisions (
        id,
        league:leagues (id)
      )
    `,
    )
    .eq("id", groupId)
    .maybeSingle();

  const rawDivision = group?.division as unknown;
  const division = (Array.isArray(rawDivision) ? rawDivision[0] : rawDivision) as
    | { league: { id: string } | { id: string }[] }
    | undefined;
  const league = division?.league;
  const leagueId = Array.isArray(league) ? league[0]?.id : league?.id;

  if (leagueId) {
    revalidatePath(`/standings/league/${leagueId}`);
  }
}

export async function revalidateStandingsForTeam(
  supabase: SupabaseClient,
  teamId: string,
): Promise<void> {
  const { data: team } = await supabase
    .from("teams")
    .select("group_id")
    .eq("id", teamId)
    .maybeSingle();

  if (team?.group_id) {
    await revalidateStandingsForGroup(supabase, team.group_id);
  }
}
