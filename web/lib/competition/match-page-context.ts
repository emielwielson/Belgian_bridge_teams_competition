import type { SupabaseClient } from "@supabase/supabase-js";
import { loadMatchContext, type MatchContext } from "@/lib/auth/match-access";

export type MatchPageBackLink = {
  href: string;
  leagueName: string | null;
  groupName: string | null;
};

export async function loadMatchForPage(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchContext | null> {
  try {
    return await loadMatchContext(supabase, matchId);
  } catch {
    return null;
  }
}

export async function loadMatchStandingsBackLink(
  supabase: SupabaseClient,
  groupId: string,
): Promise<MatchPageBackLink> {
  const { data: group, error } = await supabase
    .from("groups")
    .select(
      `
      id,
      name,
      division:divisions (
        league:leagues ( id, name )
      )
    `,
    )
    .eq("id", groupId)
    .maybeSingle();

  if (error) throw error;
  if (!group) {
    return { href: "/standings", leagueName: null, groupName: null };
  }

  const rawDivision = group.division as unknown;
  const division = (Array.isArray(rawDivision)
    ? rawDivision[0]
    : rawDivision) as {
    league: { id: string; name: string } | { id: string; name: string }[];
  } | null;
  const league = division
    ? Array.isArray(division.league)
      ? division.league[0]
      : division.league
    : null;

  return {
    href: `/standings/group/${group.id}`,
    leagueName: league?.name ?? null,
    groupName: group.name,
  };
}
