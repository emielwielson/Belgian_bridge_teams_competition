import type { SupabaseClient } from "@supabase/supabase-js";

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
