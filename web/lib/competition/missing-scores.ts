import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveLeagueForUnit,
  type CompetitionUnit,
} from "./scope-setup";
import { sortDivisionsByCanonicalName } from "./sort-divisions";

export type MissingScoreMatch = {
  id: string;
  round: number;
  datetime: string;
  groupId: string;
  groupName: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
};

export type MissingScoreDivision = {
  id: string;
  name: string;
  matches: MissingScoreMatch[];
};

export type MissingScoresResult = {
  divisions: MissingScoreDivision[];
};

type TeamEmbed = { id: string; name: string } | { id: string; name: string }[] | null;
type DivisionEmbed = { id: string; name: string } | { id: string; name: string }[] | null;
type GroupEmbed = {
  id: string;
  name: string;
  division: DivisionEmbed;
} | {
  id: string;
  name: string;
  division: DivisionEmbed;
}[] | null;

type MatchRow = {
  id: string;
  round: number;
  datetime: string;
  home_team: TeamEmbed;
  away_team: TeamEmbed;
  group: GroupEmbed;
};

function unwrapOne<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

/**
 * Matches in the active season's league for `unit` that have started
 * (`datetime <= now`) but still have no score (`played_at` is null),
 * grouped by division.
 */
export async function fetchMissingScores(
  supabase: SupabaseClient,
  seasonId: string,
  unit: CompetitionUnit,
): Promise<MissingScoresResult> {
  const league = await resolveLeagueForUnit(supabase, seasonId, unit);
  if (!league) {
    return { divisions: [] };
  }

  const { data: divisions, error: divisionsError } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("league_id", league.id);

  if (divisionsError) throw divisionsError;
  if (!divisions || divisions.length === 0) {
    return { divisions: [] };
  }

  const divisionIds = divisions.map((d) => d.id);
  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, division_id")
    .in("division_id", divisionIds);

  if (groupsError) throw groupsError;
  const groupIds = (groups ?? []).map((g) => g.id);
  if (groupIds.length === 0) {
    return { divisions: [] };
  }

  const nowIso = new Date().toISOString();
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select(
      `
      id,
      round,
      datetime,
      home_team:teams!matches_home_team_id_fkey (id, name),
      away_team:teams!matches_away_team_id_fkey (id, name),
      group:groups!inner (
        id,
        name,
        division:divisions!inner (id, name)
      )
    `,
    )
    .in("group_id", groupIds)
    .is("played_at", null)
    .lte("datetime", nowIso)
    .order("datetime", { ascending: true })
    .order("round", { ascending: true });

  if (matchesError) throw matchesError;

  const byDivision = new Map<
    string,
    { id: string; name: string; matches: MissingScoreMatch[] }
  >();

  for (const row of (matches ?? []) as MatchRow[]) {
    const group = unwrapOne<{
      id: string;
      name: string;
      division: DivisionEmbed;
    }>(row.group);
    if (!group) continue;
    const division = unwrapOne<{ id: string; name: string }>(group.division);
    if (!division) continue;
    const homeTeam = unwrapOne<{ id: string; name: string }>(row.home_team);
    const awayTeam = unwrapOne<{ id: string; name: string }>(row.away_team);
    if (!homeTeam || !awayTeam) continue;

    let bucket = byDivision.get(division.id);
    if (!bucket) {
      bucket = { id: division.id, name: division.name, matches: [] };
      byDivision.set(division.id, bucket);
    }
    bucket.matches.push({
      id: row.id,
      round: row.round,
      datetime: row.datetime,
      groupId: group.id,
      groupName: group.name,
      homeTeam,
      awayTeam,
    });
  }

  const sorted = sortDivisionsByCanonicalName([...byDivision.values()]);
  return { divisions: sorted };
}
