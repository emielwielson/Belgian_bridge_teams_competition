import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupMatchRow } from "./group-standings-grid";
import { LEAGUE_NAMES, type LeagueName } from "./league-names";
import { sortDivisionsByCanonicalName } from "./sort-divisions";

export type StandingsRow = {
  group_id: string;
  team_id: string;
  team_name: string;
  vp_total: number;
};

export type LeagueStandingsGroup = {
  id: string;
  name: string;
  standings: Omit<StandingsRow, "group_id">[];
};

export type LeagueStandingsDivision = {
  id: string;
  name: string;
  groups: LeagueStandingsGroup[];
};

export type LeagueStandings = {
  league: { id: string; name: string };
  divisions: LeagueStandingsDivision[];
};

export type ActiveSeasonLeague = {
  id: string;
  name: string;
};

export type GroupStandingsContext = {
  group: { id: string; name: string };
  division: { id: string; name: string };
  league: { id: string; name: string };
  standings: Omit<StandingsRow, "group_id">[];
};

export type GroupStandingsFullContext = GroupStandingsContext & {
  matches: GroupMatchRow[];
};

const LEAGUE_PICKER_ORDER: LeagueName[] = [
  LEAGUE_NAMES.NATIONAL,
  LEAGUE_NAMES.FLANDERS,
  LEAGUE_NAMES.WALLONIA,
];

const STANDINGS_SELECT =
  "group_id, team_id, team_name, vp_total" as const;

function sortLeaguesForPicker(leagues: ActiveSeasonLeague[]): ActiveSeasonLeague[] {
  const order = new Map(LEAGUE_PICKER_ORDER.map((name, i) => [name, i]));
  return [...leagues].sort(
    (a, b) =>
      (order.get(a.name as LeagueName) ?? 99) -
      (order.get(b.name as LeagueName) ?? 99),
  );
}

export function bucketStandingsByGroupId(
  rows: StandingsRow[],
): Map<string, Omit<StandingsRow, "group_id">[]> {
  const byGroup = new Map<string, Omit<StandingsRow, "group_id">[]>();
  for (const { group_id, team_id, team_name, vp_total } of rows) {
    const bucket = byGroup.get(group_id) ?? [];
    bucket.push({ team_id, team_name, vp_total });
    byGroup.set(group_id, bucket);
  }
  return byGroup;
}

async function getActiveSeasonId(supabase: SupabaseClient) {
  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return season?.id ?? null;
}

export async function loadActiveSeasonLeagues(
  supabase: SupabaseClient,
): Promise<ActiveSeasonLeague[]> {
  const seasonId = await getActiveSeasonId(supabase);
  if (!seasonId) return [];

  const { data: leagues, error } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("season_id", seasonId);

  if (error) throw error;
  return sortLeaguesForPicker(leagues ?? []);
}

export async function loadLeagueStandings(
  supabase: SupabaseClient,
  leagueId: string,
): Promise<LeagueStandings | null> {
  const seasonId = await getActiveSeasonId(supabase);
  if (!seasonId) return null;

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("id", leagueId)
    .eq("season_id", seasonId)
    .maybeSingle();

  if (leagueError) throw leagueError;
  if (!league) return null;

  const { data: divisions, error: divisionsError } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("league_id", leagueId);

  if (divisionsError) throw divisionsError;

  const sortedDivisions = sortDivisionsByCanonicalName(divisions ?? []);
  const divisionIds = sortedDivisions.map((d) => d.id);
  if (divisionIds.length === 0) {
    return { league, divisions: [] };
  }

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, name, division_id")
    .in("division_id", divisionIds)
    .order("name");

  if (groupsError) throw groupsError;

  const groupIds = (groups ?? []).map((g) => g.id);
  const standingsByGroup = new Map<string, Omit<StandingsRow, "group_id">[]>();

  if (groupIds.length > 0) {
    const { data: standings, error: standingsError } = await supabase
      .from("standings_group")
      .select(STANDINGS_SELECT)
      .in("group_id", groupIds)
      .order("vp_total", { ascending: false })
      .order("team_name", { ascending: true });

    if (standingsError) throw standingsError;
    for (const [groupId, rows] of bucketStandingsByGroupId(
      (standings ?? []) as StandingsRow[],
    )) {
      standingsByGroup.set(groupId, rows);
    }
  }

  const groupsByDivision = new Map<string, LeagueStandingsGroup[]>();
  for (const group of groups ?? []) {
    const divisionGroups = groupsByDivision.get(group.division_id) ?? [];
    divisionGroups.push({
      id: group.id,
      name: group.name,
      standings: standingsByGroup.get(group.id) ?? [],
    });
    groupsByDivision.set(group.division_id, divisionGroups);
  }

  return {
    league,
    divisions: sortedDivisions.map((division) => ({
      id: division.id,
      name: division.name,
      groups: groupsByDivision.get(division.id) ?? [],
    })),
  };
}

export async function loadGroupStandings(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupStandingsContext | null> {
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select(
      `
      id,
      name,
      division:divisions (
        id,
        name,
        league:leagues (
          id,
          name
        )
      )
    `,
    )
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) throw groupError;
  if (!group) return null;

  const rawDivision = group.division as unknown;
  const division = (Array.isArray(rawDivision)
    ? rawDivision[0]
    : rawDivision) as {
    id: string;
    name: string;
    league: { id: string; name: string } | { id: string; name: string }[];
  };
  const league = Array.isArray(division.league)
    ? division.league[0]
    : division.league;

  const { data: standings, error: standingsError } = await supabase
    .from("standings_group")
    .select(STANDINGS_SELECT)
    .eq("group_id", groupId)
    .order("vp_total", { ascending: false })
    .order("team_name", { ascending: true });

  if (standingsError) throw standingsError;

  return {
    group: { id: group.id, name: group.name },
    division: { id: division.id, name: division.name },
    league,
    standings: (standings ?? []).map(({ team_id, team_name, vp_total }) => ({
      team_id,
      team_name,
      vp_total,
    })),
  };
}

export async function loadGroupStandingsFull(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupStandingsFullContext | null> {
  const context = await loadGroupStandings(supabase, groupId);
  if (!context) return null;

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select(
      "id, round, datetime, home_team_id, away_team_id, vp_home, vp_away, played_at",
    )
    .eq("group_id", groupId)
    .order("round")
    .order("datetime");

  if (matchesError) throw matchesError;

  return {
    ...context,
    matches: (matches ?? []) as GroupMatchRow[],
  };
}
