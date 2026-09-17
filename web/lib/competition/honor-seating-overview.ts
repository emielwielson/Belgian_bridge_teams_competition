/**
 * Honor match-day seating overview (digital director table sheets 1t12…1t78).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { NATIONAL_LEAGUE_NAME } from "@/lib/competition/national-structure";
import {
  honorLineupPhase,
  isHonorSeatedLineupComplete,
  roundsPerRoundRobin,
  venueTablesForHonorMatch,
  type HonorDirection,
  type HonorLineupPhase,
  type HonorRoom,
  type HonorVenueTables,
} from "@/lib/competition/honor-lineup";
import {
  NATIONAL_MATCH_DAY_COUNTS,
  NATIONAL_SLOT_TIMES,
  roundForMatchDaySlot,
  slotsPerMatchDay,
} from "@/lib/competition/national-match-schedule";
import { requireActiveSeason } from "@/lib/competition/season";

export type HonorLockStatus =
  | "waiting"
  | "away_only"
  | "home_only"
  | "both";

export type HonorSeatedPlayer = {
  player_id: string;
  name: string;
  team_id: string;
  room: HonorRoom;
  direction: HonorDirection;
  is_substitute: boolean;
};

export type HonorRoundMatchSeating = {
  match_id: string;
  round: number;
  datetime: string;
  phase: HonorLineupPhase;
  home_team: { id: string; name: string };
  away_team: { id: string; name: string };
  home_lineup_locked_at: string | null;
  away_lineup_locked_at: string | null;
  lock_status: HonorLockStatus;
  home_seats_complete: boolean;
  away_seats_complete: boolean;
  venue_tables: HonorVenueTables | null;
  seats: HonorSeatedPlayer[];
};

export type HonorVenueTableSeat = {
  direction: HonorDirection;
  player_id: string | null;
  name: string | null;
  team_id: string | null;
  team_name: string | null;
  side: "home" | "away" | null;
  side_locked: boolean;
};

export type HonorVenueTableRow = {
  table: number;
  room: HonorRoom;
  match_id: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  seats: HonorVenueTableSeat[];
};

export function honorLockStatus(
  homeLocked: boolean,
  awayLocked: boolean,
): HonorLockStatus {
  if (homeLocked && awayLocked) return "both";
  if (awayLocked && !homeLocked) return "away_only";
  if (homeLocked && !awayLocked) return "home_only";
  return "waiting";
}

export function honorRoundOptions(roundCount: number): {
  round: number;
  matchDay: number;
  slotIndex: number;
  slotTime: string;
}[] {
  const slots = NATIONAL_SLOT_TIMES.honor;
  const dayCount = NATIONAL_MATCH_DAY_COUNTS.honor;
  const options: {
    round: number;
    matchDay: number;
    slotIndex: number;
    slotTime: string;
  }[] = [];

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      const round = roundForMatchDaySlot("honor", dayIndex, slotIndex);
      if (round > roundCount) continue;
      options.push({
        round,
        matchDay: dayIndex + 1,
        slotIndex,
        slotTime: slots[slotIndex] ?? "",
      });
    }
  }

  return options;
}

export function matchDayForHonorRound(round: number): number {
  const slots = slotsPerMatchDay("honor");
  return Math.floor((round - 1) / slots) + 1;
}

export function defaultHonorRound(
  matches: { round: number; datetime: string }[],
  nowMs = Date.now(),
): number {
  if (matches.length === 0) return 1;

  const byRound = new Map<number, number>();
  for (const m of matches) {
    const t = new Date(m.datetime).getTime();
    if (!byRound.has(m.round) || t < (byRound.get(m.round) ?? Infinity)) {
      byRound.set(m.round, t);
    }
  }

  const rounds = [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  const upcoming = rounds.find(([, t]) => t >= nowMs);
  if (upcoming) return upcoming[0];
  return rounds[rounds.length - 1]?.[0] ?? 1;
}

/** Map open-room table N (odd) / closed-room table N+1 to room. */
export function roomForVenueTable(table: number): HonorRoom {
  return table % 2 === 1 ? "open" : "closed";
}

export function buildHonorVenueTableGrid(
  matches: HonorRoundMatchSeating[],
): HonorVenueTableRow[] {
  const byTable = new Map<number, HonorRoundMatchSeating>();
  for (const match of matches) {
    if (!match.venue_tables) continue;
    byTable.set(match.venue_tables.openTable, match);
    byTable.set(match.venue_tables.closedTable, match);
  }

  const directions: HonorDirection[] = ["N", "S", "E", "W"];
  const rows: HonorVenueTableRow[] = [];

  for (let table = 1; table <= 8; table++) {
    const room = roomForVenueTable(table);
    const match = byTable.get(table) ?? null;
    const seats: HonorVenueTableSeat[] = directions.map((direction) => {
      if (!match) {
        return {
          direction,
          player_id: null,
          name: null,
          team_id: null,
          team_name: null,
          side: null,
          side_locked: false,
        };
      }

      const seated = match.seats.find(
        (s) => s.room === room && s.direction === direction,
      );
      if (!seated) {
        return {
          direction,
          player_id: null,
          name: null,
          team_id: null,
          team_name: null,
          side: null,
          side_locked: false,
        };
      }

      const side =
        seated.team_id === match.home_team.id
          ? "home"
          : seated.team_id === match.away_team.id
            ? "away"
            : null;
      const side_locked =
        side === "home"
          ? match.home_lineup_locked_at != null
          : side === "away"
            ? match.away_lineup_locked_at != null
            : false;

      return {
        direction,
        player_id: seated.player_id,
        name: seated.name,
        team_id: seated.team_id,
        team_name:
          side === "home"
            ? match.home_team.name
            : side === "away"
              ? match.away_team.name
              : null,
        side,
        side_locked,
      };
    });

    rows.push({
      table,
      room,
      match_id: match?.match_id ?? null,
      home_team_name: match?.home_team.name ?? null,
      away_team_name: match?.away_team.name ?? null,
      seats,
    });
  }

  return rows;
}

export type ActiveHonorGroup = {
  id: string;
  round_count: number;
  round_robin_count: number;
};

export async function resolveActiveHonorGroup(
  supabase: SupabaseClient,
): Promise<ActiveHonorGroup | null> {
  const season = await requireActiveSeason(supabase);

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", season.id)
    .eq("scope", "national")
    .eq("name", NATIONAL_LEAGUE_NAME)
    .maybeSingle();
  if (leagueError) throw leagueError;
  if (!league) return null;

  const { data: level, error: levelError } = await supabase
    .from("division_levels")
    .select("id")
    .eq("code", "honor")
    .maybeSingle();
  if (levelError) throw levelError;
  if (!level) return null;

  const { data: division, error: divisionError } = await supabase
    .from("divisions")
    .select("id")
    .eq("league_id", league.id)
    .eq("division_level_id", level.id)
    .maybeSingle();
  if (divisionError) throw divisionError;
  if (!division) return null;

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, round_count, round_robin_count")
    .eq("division_id", division.id)
    .maybeSingle();
  if (groupError) throw groupError;
  if (!group) return null;

  return {
    id: group.id,
    round_count: group.round_count ?? 21,
    round_robin_count: group.round_robin_count ?? 3,
  };
}

type TeamRef = { id: string; name: string } | { id: string; name: string }[] | null;

function firstTeam(value: TeamRef): { id: string; name: string } | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type MatchRow = {
  id: string;
  round: number;
  datetime: string;
  home_team_id: string;
  away_team_id: string;
  home_lineup_locked_at: string | null;
  away_lineup_locked_at: string | null;
  home_team: TeamRef;
  away_team: TeamRef;
};

type PlayerRow = {
  match_id: string;
  team_id: string;
  player_id: string;
  is_substitute: boolean;
  room: HonorRoom | null;
  direction: HonorDirection | null;
  player:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
};

function firstPlayer(
  value: PlayerRow["player"],
): { id: string; name: string } | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadHonorRoundSeating(
  supabase: SupabaseClient,
  group: ActiveHonorGroup,
  round: number,
): Promise<{
  matches: HonorRoundMatchSeating[];
  tables: HonorVenueTableRow[];
  phase: HonorLineupPhase;
}> {
  const roundsPerRr = roundsPerRoundRobin(
    group.round_count,
    group.round_robin_count,
  );
  const phase = honorLineupPhase(round, roundsPerRr);

  const { data: matchesData, error: matchesError } = await supabase
    .from("matches")
    .select(
      `
      id,
      round,
      datetime,
      home_team_id,
      away_team_id,
      home_lineup_locked_at,
      away_lineup_locked_at,
      home_team:teams!matches_home_team_id_fkey (id, name),
      away_team:teams!matches_away_team_id_fkey (id, name)
    `,
    )
    .eq("group_id", group.id)
    .eq("round", round)
    .order("datetime", { ascending: true });
  if (matchesError) throw matchesError;

  const matches = (matchesData ?? []) as MatchRow[];
  const matchIds = matches.map((m) => m.id);

  const { data: slots, error: slotsError } = await supabase
    .from("group_schedule_slots")
    .select("slot, team_id")
    .eq("group_id", group.id)
    .not("team_id", "is", null);
  if (slotsError) throw slotsError;

  const slotByTeam = new Map<string, number>();
  for (const row of slots ?? []) {
    if (row.team_id != null) slotByTeam.set(row.team_id, row.slot);
  }

  let playersByMatch = new Map<string, PlayerRow[]>();
  if (matchIds.length > 0) {
    const { data: players, error: playersError } = await supabase
      .from("match_players")
      .select(
        "match_id, team_id, player_id, is_substitute, room, direction, player:players(id, name)",
      )
      .in("match_id", matchIds);
    if (playersError) throw playersError;

    playersByMatch = new Map();
    for (const row of (players ?? []) as PlayerRow[]) {
      const list = playersByMatch.get(row.match_id) ?? [];
      list.push(row);
      playersByMatch.set(row.match_id, list);
    }
  }

  const seatingMatches: HonorRoundMatchSeating[] = matches.map((match) => {
    const home = firstTeam(match.home_team) ?? {
      id: match.home_team_id,
      name: "?",
    };
    const away = firstTeam(match.away_team) ?? {
      id: match.away_team_id,
      name: "?",
    };
    const homeSlot = slotByTeam.get(match.home_team_id) ?? null;
    const awaySlot = slotByTeam.get(match.away_team_id) ?? null;
    const venue_tables = venueTablesForHonorMatch({
      round: match.round,
      roundCount: group.round_count,
      homeSlot,
      awaySlot,
    });

    const rows = playersByMatch.get(match.id) ?? [];
    const seats: HonorSeatedPlayer[] = [];
    for (const row of rows) {
      if (row.room == null || row.direction == null) continue;
      const player = firstPlayer(row.player);
      seats.push({
        player_id: row.player_id,
        name: player?.name ?? "?",
        team_id: row.team_id,
        room: row.room,
        direction: row.direction,
        is_substitute: row.is_substitute,
      });
    }

    const homeRows = rows.filter((r) => r.team_id === match.home_team_id);
    const awayRows = rows.filter((r) => r.team_id === match.away_team_id);

    return {
      match_id: match.id,
      round: match.round,
      datetime: match.datetime,
      phase,
      home_team: home,
      away_team: away,
      home_lineup_locked_at: match.home_lineup_locked_at,
      away_lineup_locked_at: match.away_lineup_locked_at,
      lock_status: honorLockStatus(
        match.home_lineup_locked_at != null,
        match.away_lineup_locked_at != null,
      ),
      home_seats_complete: isHonorSeatedLineupComplete(homeRows, "home"),
      away_seats_complete: isHonorSeatedLineupComplete(awayRows, "away"),
      venue_tables,
      seats,
    };
  });

  // Stable order by open table number when known.
  seatingMatches.sort((a, b) => {
    const ao = a.venue_tables?.openTable ?? 99;
    const bo = b.venue_tables?.openTable ?? 99;
    return ao - bo;
  });

  return {
    matches: seatingMatches,
    tables: buildHonorVenueTableGrid(seatingMatches),
    phase,
  };
}

export async function loadHonorRoundMeta(
  supabase: SupabaseClient,
  groupId: string,
): Promise<{ round: number; datetime: string }[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("round, datetime")
    .eq("group_id", groupId)
    .order("round", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
