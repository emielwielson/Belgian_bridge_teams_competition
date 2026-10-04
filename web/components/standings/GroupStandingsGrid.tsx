import Link from "next/link";
import type { GroupStandingsGridData } from "@/lib/competition/group-standings-grid";

export type GroupStandingsGridLabels = {
  rank: string;
  team: string;
  vp: string;
  penaltyShort: string;
  noTeamsInGroup: string;
  roundColumnsPending: string;
  viewMatchAria: string;
  homeAria: string;
  arbiterRequestAria: string;
};

type Props = {
  grid: GroupStandingsGridData;
  labels: GroupStandingsGridLabels;
};

function HomeIcon({ linked, homeLabel }: { linked?: boolean; homeLabel: string }) {
  return (
    <svg
      aria-hidden={linked}
      aria-label={linked ? undefined : homeLabel}
      role={linked ? undefined : "img"}
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5 shrink-0"
    >
      <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7A1 1 0 0 0 3 11h1v6a1 1 0 0 0 1 1h3v-4h4v4h3a1 1 0 0 0 1-1v-6h1a1 1 0 0 0 .707-1.707l-7-7Z" />
    </svg>
  );
}

const STICKY_COLS = {
  rank: { width: "w-8 sm:w-10", left: "left-0" },
  team: { width: "w-[7rem] sm:w-[9rem]", left: "left-8 sm:left-10" },
  penalty: {
    width: "w-12 sm:w-16",
    left: "left-[9rem] sm:left-[11.5rem]",
  },
  vp: {
    width: "w-14 sm:w-16",
    left: "left-[12rem] sm:left-[15.5rem]",
  },
} as const;

const stickyHead =
  "sticky z-20 shrink-0 bg-slate-900 px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-300 sm:px-2";
const stickyHeadEdge =
  "sticky z-20 shrink-0 bg-slate-900 px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-300 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.35)] sm:px-2";
const stickyCell = "sticky z-10 shrink-0 bg-slate-50 px-1 py-1.5 sm:px-2";
const stickyCellEdge =
  "sticky z-10 shrink-0 bg-slate-50 px-1 py-1.5 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.12)] sm:px-2";

export function GroupStandingsGrid({ grid, labels }: Props) {
  const { rounds, rows, hasMatches } = grid;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">{labels.noTeamsInGroup}</p>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
      {!hasMatches ? (
        <p className="text-sm text-zinc-500">{labels.roundColumnsPending}</p>
      ) : null}
      <div className="w-full min-w-0 flex-1 overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                className={`${stickyHead} ${STICKY_COLS.rank.left} ${STICKY_COLS.rank.width}`}
              >
                {labels.rank}
              </th>
              <th
                className={`${stickyHead} ${STICKY_COLS.team.left} ${STICKY_COLS.team.width}`}
              >
                {labels.team}
              </th>
              <th
                className={`${stickyHead} ${STICKY_COLS.penalty.left} ${STICKY_COLS.penalty.width} text-right`}
              >
                {labels.penaltyShort}
              </th>
              <th
                className={`${stickyHeadEdge} ${STICKY_COLS.vp.left} ${STICKY_COLS.vp.width} text-right`}
              >
                {labels.vp}
              </th>
              {rounds.map((col) => (
                <th
                  key={col.round}
                  className="min-w-[3.25rem] bg-slate-900 px-1 py-1.5 text-right font-semibold text-slate-200"
                >
                  <span className="block whitespace-nowrap text-[11px] leading-tight tabular-nums">
                    {col.dateLabel}
                  </span>
                  <span className="block whitespace-nowrap text-[11px] font-medium leading-tight tabular-nums text-slate-400">
                    {col.timeLabel}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId} className="border-b border-slate-200">
                <td
                  className={`${stickyCell} ${STICKY_COLS.rank.left} ${STICKY_COLS.rank.width} tabular-nums text-slate-500`}
                >
                  {row.rank}
                </td>
                <td
                  className={`${stickyCell} ${STICKY_COLS.team.left} ${STICKY_COLS.team.width} max-w-[7rem] font-semibold text-slate-900 sm:max-w-[9rem]`}
                >
                  <Link
                    href={`/teams/${row.teamId}`}
                    title={row.teamName}
                    className="block truncate hover:text-emerald-800 hover:underline"
                  >
                    {row.teamName}
                  </Link>
                </td>
                <td
                  className={`${stickyCell} ${STICKY_COLS.penalty.left} ${STICKY_COLS.penalty.width} text-right tabular-nums ${
                    row.penaltyVp > 0 ? "font-medium text-rose-700" : "text-slate-400"
                  }`}
                >
                  {row.penaltyVp > 0 ? `−${row.penaltyVp}` : "0"}
                </td>
                <td
                  className={`${stickyCellEdge} ${STICKY_COLS.vp.left} ${STICKY_COLS.vp.width} text-right tabular-nums font-semibold text-slate-900`}
                >
                  {row.vpTotal}
                </td>
                {row.cells.map((cell, index) => (
                  <td
                    key={rounds[index]?.round ?? index}
                    className={[
                      "px-1 py-1.5 text-right font-medium tabular-nums",
                      cell.pairingClass ?? "bg-white text-slate-400",
                      cell.hasArbiterRequest
                        ? "outline outline-2 outline-offset-[-2px] outline-amber-500"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    title={
                      cell.hasArbiterRequest
                        ? labels.arbiterRequestAria
                        : undefined
                    }
                    aria-label={
                      cell.hasArbiterRequest
                        ? labels.arbiterRequestAria
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-end gap-1">
                      {cell.isHome && cell.matchId ? (
                        <Link
                          href={`/matches/${cell.matchId}`}
                          className="inline-flex rounded text-current/60 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-1"
                          aria-label={labels.viewMatchAria}
                        >
                          <HomeIcon linked homeLabel={labels.homeAria} />
                        </Link>
                      ) : cell.isHome ? (
                        <span className="inline-flex text-current/60">
                          <HomeIcon homeLabel={labels.homeAria} />
                        </span>
                      ) : null}
                      {cell.vp != null ? (
                        <span>{cell.vp}</span>
                      ) : cell.scheduledDateLabel || cell.scheduledTimeLabel ? (
                        <span className="text-[11px] leading-tight tabular-nums text-current/80">
                          <span className="block whitespace-nowrap">
                            {cell.scheduledDateLabel}
                          </span>
                          {cell.scheduledTimeLabel ? (
                            <span className="block whitespace-nowrap">
                              {cell.scheduledTimeLabel}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
