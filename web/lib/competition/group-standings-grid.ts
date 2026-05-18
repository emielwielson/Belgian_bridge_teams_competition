import { formatBrusselsRoundHeader } from "@/lib/time/brussels";

export const PAIRING_BG_CLASSES = [
  "bg-sky-100",
  "bg-amber-100",
  "bg-emerald-100",
  "bg-violet-100",
] as const;

export type StandingsTeamRow = {
  team_id: string;
  team_name: string;
  vp_total: number;
};

export type GroupMatchRow = {
  id: string;
  round: number;
  datetime: string;
  home_team_id: string;
  away_team_id: string;
  vp_home: number | null;
  vp_away: number | null;
  played_at: string | null;
};

export type GridCell = {
  vp: number | null;
  isHome: boolean;
  pairingClass: string | null;
  /** Home fixture in this round; links to match scoring. */
  matchId: string | null;
};

export type RoundColumn = {
  round: number;
  dateLabel: string;
  timeLabel: string;
};

export type GridRow = {
  rank: number;
  teamId: string;
  teamName: string;
  vpTotal: number;
  cells: GridCell[];
};

export type GroupStandingsGridData = {
  rounds: RoundColumn[];
  rows: GridRow[];
  hasMatches: boolean;
};

function pairingClassForIndex(index: number): string {
  return PAIRING_BG_CLASSES[index % PAIRING_BG_CLASSES.length];
}

function buildRoundColumns(matches: GroupMatchRow[]): RoundColumn[] {
  const byRound = new Map<number, string[]>();
  for (const match of matches) {
    const list = byRound.get(match.round) ?? [];
    list.push(match.datetime);
    byRound.set(match.round, list);
  }

  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, datetimes]) => {
      const earliest = datetimes.sort()[0];
      const { date, time } = formatBrusselsRoundHeader(earliest);
      return { round, dateLabel: date, timeLabel: time };
    });
}

export function buildGroupStandingsGrid(
  standings: StandingsTeamRow[],
  matches: GroupMatchRow[],
): GroupStandingsGridData {
  const rounds = buildRoundColumns(matches);
  const hasMatches = matches.length > 0;

  const cellMaps = new Map<string, Map<number, GridCell>>();

  const matchesByRound = new Map<number, GroupMatchRow[]>();
  for (const match of matches) {
    const list = matchesByRound.get(match.round) ?? [];
    list.push(match);
    matchesByRound.set(match.round, list);
  }

  for (const [round, roundMatches] of matchesByRound) {
    const sorted = [...roundMatches].sort((a, b) =>
      a.home_team_id.localeCompare(b.home_team_id),
    );
    sorted.forEach((match, pairingIndex) => {
      const pairingClass = pairingClassForIndex(pairingIndex);
      const scored = match.played_at != null;

      const homeVp = scored ? match.vp_home : null;
      const awayVp = scored ? match.vp_away : null;

      const setCell = (
        teamId: string,
        vp: number | null,
        isHome: boolean,
        matchId: string | null,
      ) => {
        let teamCells = cellMaps.get(teamId);
        if (!teamCells) {
          teamCells = new Map();
          cellMaps.set(teamId, teamCells);
        }
        teamCells.set(round, { vp, isHome, pairingClass, matchId });
      };

      setCell(match.home_team_id, homeVp, true, match.id);
      setCell(match.away_team_id, awayVp, false, null);
    });
  }

  const emptyCell: GridCell = {
    vp: null,
    isHome: false,
    pairingClass: null,
    matchId: null,
  };

  const rows: GridRow[] = standings.map((team, index) => {
    const teamCells = cellMaps.get(team.team_id);
    const cells = rounds.map(({ round }) => teamCells?.get(round) ?? emptyCell);
    return {
      rank: index + 1,
      teamId: team.team_id,
      teamName: team.team_name,
      vpTotal: team.vp_total,
      cells,
    };
  });

  return { rounds, rows, hasMatches };
}
