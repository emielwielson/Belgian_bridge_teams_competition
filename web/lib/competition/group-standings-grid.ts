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
  penalty_vp?: number;
};

export type GroupMatchRow = {
  id: string;
  round: number;
  datetime: string;
  home_team_id: string;
  away_team_id: string;
  hosting_team_id?: string | null;
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
  /** Postponed fixture date when unscored and different from the round column. */
  scheduledDateLabel: string | null;
  /** Postponed fixture time when unscored and different from the round column. */
  scheduledTimeLabel: string | null;
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
  penaltyVp: number;
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

/** Column header date: most common fixture time in the round (official schedule date). */
function roundColumnDatetime(datetimes: string[]): string | null {
  if (datetimes.length === 0) return null;

  const counts = new Map<string, number>();
  for (const dt of datetimes) {
    counts.set(dt, (counts.get(dt) ?? 0) + 1);
  }

  let best = datetimes[0];
  let bestCount = 0;
  for (const [dt, count] of counts) {
    if (
      count > bestCount ||
      (count === bestCount && dt.localeCompare(best) < 0)
    ) {
      best = dt;
      bestCount = count;
    }
  }
  return best;
}

function buildRoundColumns(
  matches: GroupMatchRow[],
  roundNumbers: number[],
  intlLocale: string,
): RoundColumn[] {
  const byRound = new Map<number, string[]>();
  for (const match of matches) {
    if (!match.home_team_id) continue;
    const list = byRound.get(match.round) ?? [];
    list.push(match.datetime);
    byRound.set(match.round, list);
  }

  return [...roundNumbers]
    .sort((a, b) => a - b)
    .map((round) => {
      const anchor =
        roundColumnDatetime(byRound.get(round) ?? []) ??
        new Date(0).toISOString();
      const { date, time } = formatBrusselsRoundHeader(anchor, intlLocale);
      return { round, dateLabel: date, timeLabel: time };
    });
}

export function buildGroupStandingsGrid(
  standings: StandingsTeamRow[],
  matches: GroupMatchRow[],
  byeRounds: GroupByeRoundRow[] = [],
  intlLocale = "en-GB",
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
  const rounds = buildRoundColumns(
    matches,
    [...roundDatetimes.keys()],
    intlLocale,
  );
  const roundColumnByRound = new Map(rounds.map((col) => [col.round, col]));
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
      const hostTeamId = match.hosting_team_id ?? match.home_team_id;

      const matchHeader = formatBrusselsRoundHeader(match.datetime, intlLocale);
      const roundCol = roundColumnByRound.get(round);
      const dateDiffers =
        roundCol != null && matchHeader.date !== roundCol.dateLabel;
      const timeDiffers =
        roundCol != null && matchHeader.time !== roundCol.timeLabel;
      const postponed = !scored && (dateDiffers || timeDiffers);
      const scheduledDateLabel = postponed && dateDiffers ? matchHeader.date : null;
      const scheduledTimeLabel =
        postponed && (dateDiffers || timeDiffers) ? matchHeader.time : null;

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
          scheduledDateLabel,
          scheduledTimeLabel,
        });
      };

      setCell(
        match.home_team_id,
        homeVp,
        hostTeamId === match.home_team_id,
        hostTeamId === match.home_team_id ? match.id : null,
      );
      setCell(
        match.away_team_id,
        awayVp,
        hostTeamId === match.away_team_id,
        hostTeamId === match.away_team_id ? match.id : null,
      );
    });
  }

  const emptyCell: GridCell = {
    vp: null,
    isHome: false,
    pairingClass: null,
    matchId: null,
    scheduledDateLabel: null,
    scheduledTimeLabel: null,
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
      scheduledDateLabel: null,
      scheduledTimeLabel: null,
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
          scheduledDateLabel: null,
          scheduledTimeLabel: null,
        };
      }
      return teamCells?.get(round) ?? emptyCell;
    });
    return {
      rank: index + 1,
      teamId: team.team_id,
      teamName: team.team_name,
      vpTotal: team.vp_total,
      penaltyVp: team.penalty_vp ?? 0,
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
