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

export type GroupByeRoundRow = {
  round: number;
  team_id: string;
  vp: number;
  awarded_at: string | null;
};

export type GridCell = {
  vp: number | null;
  isHome: boolean;
  pairingClass: string | null;
  /** Home fixture in this round; links to match scoring. */
  matchId: string | null;
  /** Compact date when unscored and different from the round column date. */
  scheduledLabel: string | null;
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
  byeRounds: GroupByeRoundRow[] = [],
): GroupStandingsGridData {
  const byeByTeamRound = new Map<string, GroupByeRoundRow>();
  for (const bye of byeRounds) {
    byeByTeamRound.set(`${bye.team_id}:${bye.round}`, bye);
  }

  const roundDatetimes = new Map<number, string[]>();
  for (const match of matches) {
    const list = roundDatetimes.get(match.round) ?? [];
    list.push(match.datetime);
    roundDatetimes.set(match.round, list);
  }
  for (const bye of byeRounds) {
    if (!roundDatetimes.has(bye.round)) {
      roundDatetimes.set(bye.round, []);
    }
  }
  const syntheticMatches: GroupMatchRow[] = [...roundDatetimes.keys()]
    .sort((a, b) => a - b)
    .filter((round) => !matches.some((m) => m.round === round))
    .map((round) => ({
      id: `bye-round-${round}`,
      round,
      datetime: new Date(0).toISOString(),
      home_team_id: "",
      away_team_id: "",
      vp_home: null,
      vp_away: null,
      played_at: null,
    }));
  const rounds = buildRoundColumns([...matches, ...syntheticMatches]);
  const roundDateLabelByRound = new Map(
    rounds.map((col) => [col.round, col.dateLabel]),
  );
  const hasMatches = matches.length > 0 || byeRounds.length > 0;

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

      const matchDateLabel = formatBrusselsRoundHeader(match.datetime).date;
      const roundDateLabel = roundDateLabelByRound.get(round);
      const scheduledLabel =
        scored || matchDateLabel === roundDateLabel ? null : matchDateLabel;

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
        teamCells.set(round, {
          vp,
          isHome,
          pairingClass,
          matchId,
          scheduledLabel,
        });
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
    scheduledLabel: null,
  };

  for (const bye of byeRounds) {
    if (!bye.awarded_at) continue;
    let teamCells = cellMaps.get(bye.team_id);
    if (!teamCells) {
      teamCells = new Map();
      cellMaps.set(bye.team_id, teamCells);
    }
    teamCells.set(bye.round, {
      vp: Number(bye.vp),
      isHome: false,
      pairingClass: null,
      matchId: null,
      scheduledLabel: null,
    });
  }

  const rows: GridRow[] = standings.map((team, index) => {
    const teamCells = cellMaps.get(team.team_id);
    const cells = rounds.map(({ round }) => {
      const bye = byeByTeamRound.get(`${team.team_id}:${round}`);
      if (bye && !bye.awarded_at) {
        return {
          vp: null,
          isHome: false,
          pairingClass: null,
          matchId: null,
          scheduledLabel: null,
        };
      }
      return teamCells?.get(round) ?? emptyCell;
    });
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

/** Strip match links the current user cannot open on /player/matches. */
export function applyAccessibleMatchLinks(
  grid: GroupStandingsGridData,
  accessibleMatchIds: ReadonlySet<string>,
): GroupStandingsGridData {
  return {
    ...grid,
    rows: grid.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => ({
        ...cell,
        matchId:
          cell.matchId && accessibleMatchIds.has(cell.matchId)
            ? cell.matchId
            : null,
      })),
    })),
  };
}
