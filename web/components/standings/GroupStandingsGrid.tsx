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

const stickyHead =
  "sticky z-20 bg-white px-2 py-2 text-left font-medium text-zinc-500 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]";
const stickyCell =
  "sticky z-10 bg-white px-2 py-1.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]";

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
      <div className="w-full min-w-0 flex-1 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className={`${stickyHead} left-0 w-10`}>{labels.rank}</th>
              <th className={`${stickyHead} left-10 min-w-[9rem]`}>{labels.team}</th>
              <th
                className={`${stickyHead} left-[10.25rem] w-16 text-right`}
              >
                {labels.penaltyShort}
              </th>
              <th
                className={`${stickyHead} left-[14.5rem] w-16 text-right`}
              >
                {labels.vp}
              </th>
              {rounds.map((col) => (
                <th
                  key={col.round}
                  className="min-w-[3.25rem] px-1 py-1.5 text-right font-medium text-zinc-500"
                >
                  <span className="block whitespace-nowrap text-[11px] leading-tight tabular-nums">
                    {col.dateLabel}
                  </span>
                  <span className="block whitespace-nowrap text-[11px] leading-tight tabular-nums">
                    {col.timeLabel}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId} className="border-b border-zinc-100">
                <td
                  className={`${stickyCell} left-0 text-zinc-500`}
                >
                  {row.rank}
                </td>
                <td className={`${stickyCell} left-10 font-medium`}>
                  <Link
                    href={`/teams/${row.teamId}`}
                    className="hover:text-emerald-800 hover:underline"
                  >
                    {row.teamName}
                  </Link>
                </td>
                <td
                  className={`${stickyCell} left-[10.25rem] text-right tabular-nums text-zinc-600`}
                >
                  {row.penaltyVp > 0 ? `−${row.penaltyVp}` : "0"}
                </td>
                <td
                  className={`${stickyCell} left-[14.5rem] text-right tabular-nums font-medium`}
                >
                  {row.vpTotal}
                </td>
                {row.cells.map((cell, index) => (
                  <td
                    key={rounds[index]?.round ?? index}
                    className={[
                      "px-1 py-1.5 text-right tabular-nums",
                      cell.pairingClass ?? "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {cell.isHome && cell.matchId ? (
                        <Link
                          href={`/matches/${cell.matchId}`}
                          className="inline-flex rounded text-zinc-500 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-1"
                          aria-label={labels.viewMatchAria}
                        >
                          <HomeIcon linked homeLabel={labels.homeAria} />
                        </Link>
                      ) : cell.isHome ? (
                        <span className="inline-flex text-zinc-500">
                          <HomeIcon homeLabel={labels.homeAria} />
                        </span>
                      ) : null}
                      {cell.vp != null ? (
                        <span>{cell.vp}</span>
                      ) : cell.scheduledLabel ? (
                        <span className="text-[11px] text-zinc-600">
                          {cell.scheduledLabel}
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
