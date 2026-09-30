import { unstable_cache } from "next/cache";
import {
  fetchGroupMatchIdsWithArbiterRequests,
  loadGroupDisciplineData,
  loadGroupStandingsGridData,
  loadLeagueArbiterRequestSummaries,
  loadLeagueStandings,
  type GroupStandingsGridData,
  type LeagueArbiterRequestSummary,
  type LeagueStandings,
} from "./standings-queries";
import {
  createPublicClient,
  createServiceClient,
} from "@/lib/supabase/server-client";

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
    async () => {
      const [data, requestMatchIds] = await Promise.all([
        loadGroupStandingsGridData(createPublicClient(), groupId),
        fetchGroupMatchIdsWithArbiterRequests(createServiceClient(), groupId),
      ]);
      if (!data) return null;
      return {
        ...data,
        arbiterRequestMatchIds: [...requestMatchIds],
      };
    },
    ["group-standings-grid-v2", groupId],
    { tags: [standingsGroupTag(groupId)] },
  )();
}

export async function getCachedGroupDisciplineData(groupId: string) {
  return unstable_cache(
    async () => loadGroupDisciplineData(createPublicClient(), groupId),
    ["group-discipline-v2", groupId],
    { tags: [standingsGroupTag(groupId)] },
  )();
}

export async function getCachedLeagueStandings(
  leagueId: string,
): Promise<LeagueStandings | null> {
  return unstable_cache(
    async () => loadLeagueStandings(createPublicClient(), leagueId),
    // v2: include Zweiffel Honneur→APM canonical division order
    ["league-standings-v2", leagueId],
    { tags: [standingsLeagueTag(leagueId)] },
  )();
}

export async function getCachedLeagueArbiterRequests(
  leagueId: string,
): Promise<LeagueArbiterRequestSummary[] | null> {
  return unstable_cache(
    async () =>
      loadLeagueArbiterRequestSummaries(createServiceClient(), leagueId),
    ["league-arbiter-requests", leagueId],
    { tags: [standingsLeagueTag(leagueId)] },
  )();
}
