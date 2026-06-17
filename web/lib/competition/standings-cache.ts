import { unstable_cache } from "next/cache";
import {
  loadGroupDisciplineData,
  loadGroupStandingsGridData,
  loadLeagueStandings,
  type GroupStandingsGridData,
  type LeagueStandings,
} from "./standings-queries";
import { createPublicClient } from "@/lib/supabase/server-client";

export function standingsGroupTag(groupId: string) {
  return `standings-group-${groupId}`;
}

export function standingsLeagueTag(leagueId: string) {
  return `standings-league-${leagueId}`;
}

export async function getCachedGroupStandingsGrid(
  groupId: string,
): Promise<GroupStandingsGridData | null> {
  return unstable_cache(
    async () => loadGroupStandingsGridData(createPublicClient(), groupId),
    ["group-standings-grid", groupId],
    { tags: [standingsGroupTag(groupId)] },
  )();
}

export async function getCachedGroupDisciplineData(groupId: string) {
  return unstable_cache(
    async () => loadGroupDisciplineData(createPublicClient(), groupId),
    ["group-discipline", groupId],
    { tags: [standingsGroupTag(groupId)] },
  )();
}

export async function getCachedLeagueStandings(
  leagueId: string,
): Promise<LeagueStandings | null> {
  return unstable_cache(
    async () => loadLeagueStandings(createPublicClient(), leagueId),
    ["league-standings", leagueId],
    { tags: [standingsLeagueTag(leagueId)] },
  )();
}
