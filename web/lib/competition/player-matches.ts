import type { SupabaseClient } from "@supabase/supabase-js";
import { getManagedClubIds } from "@/lib/auth/user-access";

export type PlayerMatchSummary = {
  id: string;
  round: number;
  datetime: string;
  played_at: string | null;
  home_team: { id: string; name: string };
  away_team: { id: string; name: string };
};

export async function loadUpcomingMatchesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlayerMatchSummary[]> {
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!player) return [];

  const { data: teamRows, error: teamError } = await supabase
    .from("team_players")
    .select("team_id")
    .eq("player_id", player.id);

  if (teamError) throw teamError;

  const teamIds = teamRows?.map((r) => r.team_id) ?? [];
  if (teamIds.length === 0) return [];

  const [homeRes, awayRes] = await Promise.all([
    supabase
      .from("matches")
      .select("id, round, datetime, played_at, home_team_id, away_team_id")
      .in("home_team_id", teamIds)
      .is("played_at", null)
      .order("datetime"),
    supabase
      .from("matches")
      .select("id, round, datetime, played_at, home_team_id, away_team_id")
      .in("away_team_id", teamIds)
      .is("played_at", null)
      .order("datetime"),
  ]);

  if (homeRes.error) throw homeRes.error;
  if (awayRes.error) throw awayRes.error;

  const byId = new Map<string, (typeof homeRes.data)[number]>();
  for (const m of homeRes.data ?? []) byId.set(m.id, m);
  for (const m of awayRes.data ?? []) byId.set(m.id, m);

  const raw = [...byId.values()].sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
  );

  if (raw.length === 0) return [];

  const teamIdSet = new Set(
    raw.flatMap((m) => [m.home_team_id, m.away_team_id]),
  );
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", [...teamIdSet]);

  const teamMap = new Map(teams?.map((t) => [t.id, t.name]) ?? []);

  return raw.map((m) => ({
    id: m.id,
    round: m.round,
    datetime: m.datetime,
    played_at: m.played_at,
    home_team: {
      id: m.home_team_id,
      name: teamMap.get(m.home_team_id) ?? "Home",
    },
    away_team: {
      id: m.away_team_id,
      name: teamMap.get(m.away_team_id) ?? "Away",
    },
  }));
}

export type ScorableMatchSummary = PlayerMatchSummary & {
  group_name: string;
  status: "scheduled";
};

async function resolveUserTeamIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const teamIdSet = new Set<string>();

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (player) {
    const { data: teamRows, error: teamError } = await supabase
      .from("team_players")
      .select("team_id")
      .eq("player_id", player.id);
    if (teamError) throw teamError;
    for (const r of teamRows ?? []) teamIdSet.add(r.team_id);
  }

  const clubIds = await getManagedClubIds(supabase, userId);
  if (clubIds.length > 0) {
    const { data: clubTeams, error: clubTeamError } = await supabase
      .from("teams")
      .select("id")
      .in("club_id", clubIds);
    if (clubTeamError) throw clubTeamError;
    for (const t of clubTeams ?? []) teamIdSet.add(t.id);
  }

  return teamIdSet;
}

async function loadUnplayedMatchRows(
  supabase: SupabaseClient,
  teamIds: string[],
): Promise<
  {
    id: string;
    round: number;
    datetime: string;
    played_at: string | null;
    home_team_id: string;
    away_team_id: string;
    group_id: string;
  }[]
> {
  if (teamIds.length === 0) return [];

  const [homeRes, awayRes] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, round, datetime, played_at, home_team_id, away_team_id, group_id",
      )
      .in("home_team_id", teamIds)
      .is("played_at", null),
    supabase
      .from("matches")
      .select(
        "id, round, datetime, played_at, home_team_id, away_team_id, group_id",
      )
      .in("away_team_id", teamIds)
      .is("played_at", null),
  ]);
  if (homeRes.error) throw homeRes.error;
  if (awayRes.error) throw awayRes.error;
  const byId = new Map<string, (typeof homeRes.data)[number]>();
  for (const m of homeRes.data ?? []) byId.set(m.id, m);
  for (const m of awayRes.data ?? []) byId.set(m.id, m);
  return [...byId.values()];
}

export async function loadScorableMatchesForUser(
  supabase: SupabaseClient,
  userId: string,
  _roles: string[],
): Promise<ScorableMatchSummary[]> {
  const userTeamIds = await resolveUserTeamIds(supabase, userId);
  if (userTeamIds.size === 0) return [];

  const scorable = await loadUnplayedMatchRows(supabase, [...userTeamIds]);
  if (scorable.length === 0) return [];

  const teamIdSet = new Set(
    scorable.flatMap((m) => [m.home_team_id, m.away_team_id]),
  );
  const groupIdSet = new Set(scorable.map((m) => m.group_id));

  const [{ data: teams }, { data: groups }] = await Promise.all([
    supabase.from("teams").select("id, name").in("id", [...teamIdSet]),
    supabase.from("groups").select("id, name").in("id", [...groupIdSet]),
  ]);

  const teamMap = new Map(teams?.map((t) => [t.id, t.name]) ?? []);
  const groupMap = new Map(groups?.map((g) => [g.id, g.name]) ?? []);

  return scorable
    .sort(
      (a, b) =>
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
    )
    .map((m) => ({
      id: m.id,
      round: m.round,
      datetime: m.datetime,
      played_at: m.played_at,
      home_team: {
        id: m.home_team_id,
        name: teamMap.get(m.home_team_id) ?? "Home",
      },
      away_team: {
        id: m.away_team_id,
        name: teamMap.get(m.away_team_id) ?? "Away",
      },
      group_name: groupMap.get(m.group_id) ?? "Group",
      status: "scheduled" as const,
    }));
}

export type ClubSubCandidate = {
  id: string;
  name: string;
  member_number: string | null;
};

/** Club members in the active season who are not on the team roster (FR 30). */
export async function loadClubSubCandidates(
  supabase: SupabaseClient,
  clubId: string,
  teamId: string,
  seasonId: string,
): Promise<ClubSubCandidate[]> {
  const { data: rosterRows, error: rosterError } = await supabase
    .from("team_players")
    .select("player_id")
    .eq("team_id", teamId)
    .eq("season_id", seasonId);

  if (rosterError) throw rosterError;

  const rosterIds = new Set(rosterRows?.map((r) => r.player_id) ?? []);

  const { data: memberships, error } = await supabase
    .from("player_club_memberships")
    .select("player:players(id, name, member_number)")
    .eq("club_id", clubId)
    .eq("season_id", seasonId);

  if (error) throw error;

  const players = (memberships ?? [])
    .map(
      (row) =>
        row.player as {
          id: string;
          name: string;
          member_number: string | null;
        } | null,
    )
    .filter(
      (
        p,
      ): p is { id: string; name: string; member_number: string | null } =>
        p != null && !rosterIds.has(p.id),
    );

  return players.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadTeamRoster(
  supabase: SupabaseClient,
  teamId: string,
): Promise<{ id: string; name: string; member_number: string | null }[]> {
  const { data, error } = await supabase
    .from("team_players")
    .select("player:players(id, name, member_number)")
    .eq("team_id", teamId);

  if (error) throw error;

  return (data ?? [])
    .map(
      (row) =>
        row.player as {
          id: string;
          name: string;
          member_number: string | null;
        } | null,
    )
    .filter(
      (
        p,
      ): p is { id: string; name: string; member_number: string | null } =>
        p != null,
    );
}
