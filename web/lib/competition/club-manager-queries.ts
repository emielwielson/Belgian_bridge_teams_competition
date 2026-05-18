import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveSeason } from "@/lib/competition/season";
import { teamLocationFromClub } from "@/lib/competition/team-location";

export type ClubOverviewPlayer = {
  membership_id: string;
  player_id: string;
  name: string;
  member_number: string | null;
  team_id: string | null;
  team_name: string | null;
};

export type ClubOverviewTeam = {
  id: string;
  name: string;
  captain_id: string | null;
  captain_name: string | null;
  group_name: string;
  division_name: string;
  league_name: string;
  roster_count: number;
};

export type ClubOverview = {
  club: {
    id: string;
    name: string;
    location: string | null;
    region: { code: string; name: string } | null;
  };
  season: { id: string; name: string; status: string } | null;
  players: ClubOverviewPlayer[];
  teams: ClubOverviewTeam[];
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadClubOverview(
  supabase: SupabaseClient,
  clubId: string,
): Promise<ClubOverview | null> {
  const { data: clubRow, error: clubError } = await supabase
    .from("clubs")
    .select("id, name, location, region:regions(code, name)")
    .eq("id", clubId)
    .maybeSingle();

  if (clubError) throw clubError;
  if (!clubRow) return null;

  const regionRaw = unwrapOne(
    clubRow.region as { code: string; name: string } | null,
  );
  const season = await getActiveSeason(supabase);

  let players: ClubOverviewPlayer[] = [];
  let teams: ClubOverviewTeam[] = [];

  if (season) {
    const { data: memberships, error: memError } = await supabase
      .from("player_club_memberships")
      .select("id, player_id, player:players(id, name, member_number)")
      .eq("club_id", clubId)
      .eq("season_id", season.id);

    if (memError) throw memError;

    const { data: teamRows, error: teamsError } = await supabase
      .from("teams")
      .select(
        `
        id,
        name,
        captain_id,
        captain:players(id, name),
        group:groups (
          name,
          division:divisions (
            name,
            league:leagues (name)
          )
        )
      `,
      )
      .eq("club_id", clubId)
      .order("name");

    if (teamsError) throw teamsError;

    const teamIds = teamRows?.map((t) => t.id) ?? [];
    const rosterByTeam = new Map<string, number>();
    const assignmentByPlayer = new Map<
      string,
      { team_id: string; team_name: string }
    >();

    if (teamIds.length > 0) {
      const { data: rosterRows, error: rosterError } = await supabase
        .from("team_players")
        .select("team_id, player_id, team:teams(id, name)")
        .in("team_id", teamIds)
        .eq("season_id", season.id);

      if (rosterError) throw rosterError;

      for (const row of rosterRows ?? []) {
        rosterByTeam.set(row.team_id, (rosterByTeam.get(row.team_id) ?? 0) + 1);
        const team = unwrapOne(row.team as { id: string; name: string } | null);
        if (team) {
          assignmentByPlayer.set(row.player_id, {
            team_id: team.id,
            team_name: team.name,
          });
        }
      }
    }

    teams = (teamRows ?? []).map((t) => {
      const group = unwrapOne(
        t.group as {
          name: string;
          division: { name: string; league: { name: string } | { name: string }[] };
        } | null,
      );
      const division = group
        ? unwrapOne(group.division as { name: string; league: unknown })
        : null;
      const league = division
        ? unwrapOne(division.league as { name: string })
        : null;
      const captain = unwrapOne(
        t.captain as { id: string; name: string } | null,
      );
      return {
        id: t.id,
        name: t.name,
        captain_id: t.captain_id,
        captain_name: captain?.name ?? null,
        group_name: group?.name ?? "—",
        division_name: division?.name ?? "—",
        league_name: league?.name ?? "—",
        roster_count: rosterByTeam.get(t.id) ?? 0,
      };
    });

    players = (memberships ?? [])
      .map((m) => {
        const player = unwrapOne(
          m.player as {
            id: string;
            name: string;
            member_number: string | null;
          } | null,
        );
        if (!player) return null;
        const onTeam = assignmentByPlayer.get(player.id);
        return {
          membership_id: m.id,
          player_id: player.id,
          name: player.name,
          member_number: player.member_number,
          team_id: onTeam?.team_id ?? null,
          team_name: onTeam?.team_name ?? null,
        };
      })
      .filter((p): p is ClubOverviewPlayer => p != null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    club: {
      id: clubRow.id,
      name: clubRow.name,
      location: teamLocationFromClub(clubRow),
      region: regionRaw,
    },
    season: season
      ? { id: season.id, name: season.name, status: season.status }
      : null,
    players,
    teams,
  };
}

export type ClubTeamDetail = {
  team: {
    id: string;
    name: string;
    location: string | null;
    captain_id: string | null;
    club_id: string;
    group_name: string;
    division_name: string;
    league_name: string;
  };
  season: { id: string; name: string; status: string } | null;
  roster: { player_id: string; name: string; member_number: string | null }[];
  roster_editable: boolean;
  available_players: { player_id: string; name: string; member_number: string | null }[];
  matches: {
    id: string;
    round: number;
    datetime: string;
    played_at: string | null;
    is_home: boolean;
    opponent_name: string;
  }[];
};

export async function loadClubTeamDetail(
  supabase: SupabaseClient,
  clubId: string,
  teamId: string,
): Promise<ClubTeamDetail | null> {
  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select(
      `
      id,
      name,
      captain_id,
      club_id,
      club:clubs (location),
      group:groups (
        name,
        division:divisions (
          name,
          league:leagues (name)
        )
      )
    `,
    )
    .eq("id", teamId)
    .maybeSingle();

  if (teamError) throw teamError;
  if (!teamRow || teamRow.club_id !== clubId) return null;

  const group = unwrapOne(teamRow.group as unknown);
  const division = group
    ? unwrapOne(
        (group as { division: unknown }).division as {
          name: string;
          league: unknown;
        },
      )
    : null;
  const league = division ? unwrapOne(division.league as { name: string }) : null;

  const season = await getActiveSeason(supabase);
  const roster_editable = season?.status === "setup";
  let roster: ClubTeamDetail["roster"] = [];
  let available_players: ClubTeamDetail["available_players"] = [];

  if (season) {
    const { data: rosterRows } = await supabase
      .from("team_players")
      .select("player_id, player:players(id, name, member_number)")
      .eq("team_id", teamId)
      .eq("season_id", season.id);

    roster = (rosterRows ?? [])
      .map((r) => {
        const p = unwrapOne(
          r.player as {
            id: string;
            name: string;
            member_number: string | null;
          } | null,
        );
        if (!p) return null;
        return {
          player_id: p.id,
          name: p.name,
          member_number: p.member_number,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p != null)
      .sort((a, b) => a.name.localeCompare(b.name));

    const { data: memberships } = await supabase
      .from("player_club_memberships")
      .select("player_id, player:players(id, name, member_number)")
      .eq("club_id", clubId)
      .eq("season_id", season.id);

    const { data: clubTeams } = await supabase
      .from("teams")
      .select("id, name")
      .eq("club_id", clubId);

    const clubTeamIds = clubTeams?.map((t) => t.id) ?? [];
    const assignmentByPlayer = new Map<
      string,
      { team_id: string; team_name: string }
    >();

    if (clubTeamIds.length > 0) {
      const { data: clubAssignments } = await supabase
        .from("team_players")
        .select("player_id, team_id, team:teams(id, name)")
        .in("team_id", clubTeamIds)
        .eq("season_id", season.id);

      for (const row of clubAssignments ?? []) {
        const team = unwrapOne(row.team as { id: string; name: string } | null);
        if (team) {
          assignmentByPlayer.set(row.player_id, {
            team_id: team.id,
            team_name: team.name,
          });
        }
      }
    }

    const onRoster = new Set(roster.map((r) => r.player_id));

    for (const m of memberships ?? []) {
      const p = unwrapOne(
        m.player as {
          id: string;
          name: string;
          member_number: string | null;
        } | null,
      );
      if (!p || onRoster.has(p.id)) continue;

      const assignment = assignmentByPlayer.get(p.id);
      if (!assignment) {
        available_players.push({
          player_id: p.id,
          name: p.name,
          member_number: p.member_number,
        });
      }
    }

    available_players.sort((a, b) => a.name.localeCompare(b.name));
  }

  const [homeMatches, awayMatches] = await Promise.all([
    supabase
      .from("matches")
      .select("id, round, datetime, played_at, away_team_id, away_team:teams!matches_away_team_id_fkey(name)")
      .eq("home_team_id", teamId)
      .order("datetime"),
    supabase
      .from("matches")
      .select("id, round, datetime, played_at, home_team_id, home_team:teams!matches_home_team_id_fkey(name)")
      .eq("away_team_id", teamId)
      .order("datetime"),
  ]);

  if (homeMatches.error) throw homeMatches.error;
  if (awayMatches.error) throw awayMatches.error;

  const matches: ClubTeamDetail["matches"] = [];
  for (const m of homeMatches.data ?? []) {
    const away = unwrapOne(m.away_team as { name: string } | null);
    matches.push({
      id: m.id,
      round: m.round,
      datetime: m.datetime,
      played_at: m.played_at,
      is_home: true,
      opponent_name: away?.name ?? "Away",
    });
  }
  for (const m of awayMatches.data ?? []) {
    const home = unwrapOne(m.home_team as { name: string } | null);
    matches.push({
      id: m.id,
      round: m.round,
      datetime: m.datetime,
      played_at: m.played_at,
      is_home: false,
      opponent_name: home?.name ?? "Home",
    });
  }
  matches.sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
  );

  const clubRaw = unwrapOne(
    teamRow.club as { location: string | null } | null,
  );

  return {
    team: {
      id: teamRow.id,
      name: teamRow.name,
      location: teamLocationFromClub(clubRaw),
      captain_id: teamRow.captain_id,
      club_id: teamRow.club_id,
      group_name: group?.name ?? "—",
      division_name: division?.name ?? "—",
      league_name: league?.name ?? "—",
    },
    season: season
      ? { id: season.id, name: season.name, status: season.status }
      : null,
    roster,
    roster_editable,
    available_players,
    matches,
  };
}
