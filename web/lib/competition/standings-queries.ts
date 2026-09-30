import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { GroupByeRoundRow, GroupMatchRow } from "./group-standings-grid";
import { LEAGUE_NAMES, type LeagueName } from "./league-names";
import { sortDivisionsByCanonicalName } from "./sort-divisions";

export type StandingsRow = {
  group_id: string;
  team_id: string;
  team_name: string;
  vp_total: number;
  penalty_vp?: number;
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

export type GroupStandingsGridData = GroupStandingsContext & {
  matches: GroupMatchRow[];
  byeRounds: GroupByeRoundRow[];
  /** Match IDs with open or resolved arbiter requests (not cancelled). */
  arbiterRequestMatchIds: string[];
};

export type GroupStandingsFullContext = GroupStandingsGridData & {
  penalties: GroupPenaltyRow[];
  warnings: GroupWarningRow[];
  rulings: GroupRulingRow[];
};

export type GroupPenaltyRow = {
  id: string;
  team_id: string;
  penalty_date: string;
  reason: string;
  vp_deduction: number;
  file_path: string | null;
  team: { id: string; name: string } | null;
};

export type GroupWarningRow = {
  id: string;
  team_id: string;
  warning_date: string;
  reason: string;
  team: { id: string; name: string } | null;
};

export type GroupRulingRow = {
  id: string;
  match_id: string;
  board: number | null;
  ruling_date: string | null;
  file_path: string;
  arbiter_request_id: string | null;
  signed_url: string | null;
  match: {
    round: number;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  } | null;
};

export type LeagueArbiterRequestSummary = {
  id: string;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
  group_id: string;
  group_name: string;
  match_id: string;
  round: number;
  home_team_name: string;
  away_team_name: string;
  ruling_file_path: string | null;
  ruling_signed_url: string | null;
};

type StandingsRpcRow = {
  group_id: string;
  team_id: string;
  team_name: string;
  match_vp_total: number | string;
  penalty_vp: number | string;
  vp_total: number | string;
};

const LEAGUE_PICKER_ORDER: LeagueName[] = [
  LEAGUE_NAMES.NATIONAL,
  LEAGUE_NAMES.FLANDERS,
  LEAGUE_NAMES.WALLONIA,
  LEAGUE_NAMES.ZWEIFFEL,
];

function isMissingHostingTeamIdColumn(error: PostgrestError | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" &&
    typeof error.message === "string" &&
    error.message.includes("hosting_team_id")
  );
}

function sortStandingsRows<T extends { vp_total: number; team_name: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (b.vp_total !== a.vp_total) return b.vp_total - a.vp_total;
    return a.team_name.localeCompare(b.team_name);
  });
}

function mapRpcRow(row: StandingsRpcRow): StandingsRow {
  return {
    group_id: row.group_id,
    team_id: row.team_id,
    team_name: row.team_name,
    vp_total: Number(row.vp_total),
    penalty_vp: Number(row.penalty_vp ?? 0),
  };
}

async function fetchStandingsForGroups(
  supabase: SupabaseClient,
  groupIds: string[],
): Promise<StandingsRow[]> {
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase.rpc("standings_for_groups", {
    p_group_ids: groupIds,
  });

  if (error) throw error;

  return sortStandingsRows((data ?? []).map(mapRpcRow));
}

/** FR 40-43: scored matches + penalty corrections via standings_for_groups RPC. */
export async function fetchGroupStandings(
  supabase: SupabaseClient,
  groupId: string,
): Promise<Omit<StandingsRow, "group_id">[]> {
  const rows = await fetchStandingsForGroups(supabase, [groupId]);
  return rows.map(({ team_id, team_name, vp_total, penalty_vp }) => ({
    team_id,
    team_name,
    vp_total,
    penalty_vp,
  }));
}

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
    const standings = await fetchStandingsForGroups(supabase, groupIds);
    for (const [groupId, rows] of bucketStandingsByGroupId(standings)) {
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

async function loadGroupContext(
  supabase: SupabaseClient,
  groupId: string,
): Promise<Omit<GroupStandingsContext, "standings"> | null> {
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

  return {
    group: { id: group.id, name: group.name },
    division: { id: division.id, name: division.name },
    league,
  };
}

async function fetchGroupMatches(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupMatchRow[]> {
  let { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select(
      "id, round, datetime, home_team_id, away_team_id, hosting_team_id, vp_home, vp_away, played_at",
    )
    .eq("group_id", groupId)
    .order("round")
    .order("datetime");

  if (isMissingHostingTeamIdColumn(matchesError)) {
    const fallback = await supabase
      .from("matches")
      .select("id, round, datetime, home_team_id, away_team_id, vp_home, vp_away, played_at")
      .eq("group_id", groupId)
      .order("round")
      .order("datetime");
    matches =
      fallback.data?.map((m) => ({ ...m, hosting_team_id: null })) ?? null;
    matchesError = fallback.error;
  }

  if (matchesError) throw matchesError;
  return (matches ?? []) as GroupMatchRow[];
}

async function fetchGroupByeRounds(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupByeRoundRow[]> {
  const { data: byeRounds, error: byeError } = await supabase
    .from("group_bye_rounds")
    .select("round, team_id, vp, awarded_at")
    .eq("group_id", groupId)
    .order("round");

  if (byeError) throw byeError;
  return (byeRounds ?? []) as GroupByeRoundRow[];
}

export async function fetchGroupPenalties(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupPenaltyRow[]> {
  const { data: penaltyRows, error: penaltyError } = await supabase
    .from("penalties")
    .select(
      `
        id,
        team_id,
        penalty_date,
        reason,
        vp_deduction,
        file_path,
        team:teams!inner (id, name, group_id)
      `,
    )
    .eq("team.group_id", groupId)
    .order("penalty_date", { ascending: false });

  if (penaltyError) throw penaltyError;
  return (penaltyRows ?? []) as unknown as GroupPenaltyRow[];
}

export async function fetchGroupRulings(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupRulingRow[]> {
  const { data: rulingRows, error: rulingError } = await supabase
    .from("rulings")
    .select(
      `
        id,
        match_id,
        board,
        ruling_date,
        file_path,
        arbiter_request_id,
        match:matches!inner (
          round,
          home_team:teams!matches_home_team_id_fkey (name),
          away_team:teams!matches_away_team_id_fkey (name)
        )
      `,
    )
    .eq("match.group_id", groupId)
    .order("ruling_date", { ascending: false });

  if (rulingError) throw rulingError;
  return (rulingRows ?? []).map((row) => ({
    ...row,
    signed_url: null,
  })) as unknown as GroupRulingRow[];
}

export async function fetchGroupWarnings(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupWarningRow[]> {
  const { data: warningRows, error: warningError } = await supabase
    .from("warnings")
    .select(
      `
        id,
        team_id,
        warning_date,
        reason,
        team:teams!inner (id, name, group_id)
      `,
    )
    .eq("team.group_id", groupId)
    .order("warning_date", { ascending: false });

  if (warningError) throw warningError;
  return (warningRows ?? []) as unknown as GroupWarningRow[];
}

/** Match IDs with open or resolved arbiter requests. Requires a client that can read arbiter_requests (service role). */
export async function fetchGroupMatchIdsWithArbiterRequests(
  supabase: SupabaseClient,
  groupId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("arbiter_requests")
    .select(
      `
      match_id,
      match:matches!inner (group_id)
    `,
    )
    .eq("match.group_id", groupId)
    .in("status", ["open", "resolved"]);

  if (error) throw error;

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.match_id) ids.add(row.match_id);
  }
  return ids;
}

export async function loadGroupStandings(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupStandingsContext | null> {
  const context = await loadGroupContext(supabase, groupId);
  if (!context) return null;

  const standings = await fetchGroupStandings(supabase, groupId);
  return { ...context, standings };
}

export async function loadGroupStandingsGridData(
  supabase: SupabaseClient,
  groupId: string,
  options?: { arbiterRequestMatchIds?: ReadonlySet<string> },
): Promise<GroupStandingsGridData | null> {
  const context = await loadGroupContext(supabase, groupId);
  if (!context) return null;

  const [standings, matches, byeRounds] = await Promise.all([
    fetchGroupStandings(supabase, groupId),
    fetchGroupMatches(supabase, groupId),
    fetchGroupByeRounds(supabase, groupId),
  ]);

  return {
    ...context,
    standings,
    matches,
    byeRounds,
    arbiterRequestMatchIds: [...(options?.arbiterRequestMatchIds ?? [])],
  };
}

export async function loadGroupDisciplineData(
  supabase: SupabaseClient,
  groupId: string,
): Promise<{
  penalties: GroupPenaltyRow[];
  warnings: GroupWarningRow[];
  rulings: GroupRulingRow[];
}> {
  const [penalties, warnings, rulings] = await Promise.all([
    fetchGroupPenalties(supabase, groupId),
    fetchGroupWarnings(supabase, groupId),
    fetchGroupRulings(supabase, groupId),
  ]);

  return { penalties, warnings, rulings };
}

export async function loadGroupStandingsFull(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupStandingsFullContext | null> {
  const gridData = await loadGroupStandingsGridData(supabase, groupId);
  if (!gridData) return null;

  const { penalties, warnings, rulings } = await loadGroupDisciplineData(
    supabase,
    groupId,
  );

  return { ...gridData, penalties, warnings, rulings };
}

type LeagueRequestQueryRow = {
  id: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  match_id: string;
  match: {
    round: number;
    group_id: string;
    home_team: { name: string } | { name: string }[] | null;
    away_team: { name: string } | { name: string }[] | null;
  } | {
    round: number;
    group_id: string;
    home_team: { name: string } | { name: string }[] | null;
    away_team: { name: string } | { name: string }[] | null;
  }[] | null;
  rulings:
    | { file_path: string }[]
    | { file_path: string }
    | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function teamName(
  team: { name: string } | { name: string }[] | null | undefined,
): string {
  const row = firstRelation(team);
  return row?.name ?? "?";
}

/** Open/resolved requests for a league. Requires service-role client for arbiter_requests. */
export async function loadLeagueArbiterRequestSummaries(
  supabase: SupabaseClient,
  leagueId: string,
): Promise<LeagueArbiterRequestSummary[] | null> {
  const seasonId = await getActiveSeasonId(supabase);
  if (!seasonId) return null;

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id")
    .eq("id", leagueId)
    .eq("season_id", seasonId)
    .maybeSingle();

  if (leagueError) throw leagueError;
  if (!league) return null;

  const { data: divisions, error: divisionsError } = await supabase
    .from("divisions")
    .select("id")
    .eq("league_id", leagueId);

  if (divisionsError) throw divisionsError;
  const divisionIds = (divisions ?? []).map((d) => d.id);
  if (divisionIds.length === 0) return [];

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, name")
    .in("division_id", divisionIds);

  if (groupsError) throw groupsError;
  const groupById = new Map((groups ?? []).map((g) => [g.id, g.name]));
  const groupIds = [...groupById.keys()];
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from("arbiter_requests")
    .select(
      `
      id,
      status,
      created_at,
      resolved_at,
      match_id,
      match:matches!inner (
        round,
        group_id,
        home_team:teams!matches_home_team_id_fkey (name),
        away_team:teams!matches_away_team_id_fkey (name)
      ),
      rulings (file_path)
    `,
    )
    .in("status", ["open", "resolved"])
    .in("match.group_id", groupIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const summaries: LeagueArbiterRequestSummary[] = [];
  for (const row of (data ?? []) as LeagueRequestQueryRow[]) {
    const match = firstRelation(row.match);
    if (!match) continue;
    const groupName = groupById.get(match.group_id);
    if (!groupName) continue;

    const ruling = firstRelation(row.rulings);

    summaries.push({
      id: row.id,
      status: row.status === "resolved" ? "resolved" : "open",
      created_at: row.created_at,
      resolved_at: row.resolved_at,
      group_id: match.group_id,
      group_name: groupName,
      match_id: row.match_id,
      round: match.round,
      home_team_name: teamName(match.home_team),
      away_team_name: teamName(match.away_team),
      ruling_file_path: ruling?.file_path ?? null,
      ruling_signed_url: null,
    });
  }

  return summaries;
}
