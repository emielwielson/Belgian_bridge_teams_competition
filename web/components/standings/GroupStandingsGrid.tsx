import type { GroupStandingsGridData } from "@/lib/competition/group-standings-grid";

type Props = {
  grid: GroupStandingsGridData;
};

function HomeIcon() {
  return (
    <svg
      aria-label="Home"
      role="img"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5 shrink-0 text-zinc-500"
    >
      <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7A1 1 0 0 0 3 11h1v6a1 1 0 0 0 1 1h3v-4h4v4h3a1 1 0 0 0 1-1v-6h1a1 1 0 0 0 .707-1.707l-7-7Z" />
    </svg>
  );
}

const stickyHead =
  "sticky z-20 bg-white px-2 py-2 text-left font-medium text-zinc-500 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]";
const stickyCell =
  "sticky z-10 bg-white px-2 py-1.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]";

export function GroupStandingsGrid({ grid }: Props) {
  const { rounds, rows, hasMatches } = grid;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No teams in this group yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!hasMatches ? (
        <p className="text-sm text-zinc-500">
          Round columns appear after the match schedule is generated.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className={`${stickyHead} left-0 w-10`}>#</th>
              <th className={`${stickyHead} left-10 min-w-[9rem]`}>Team</th>
              <th
                className={`${stickyHead} left-[10.25rem] w-16 text-right`}
              >
                VP
              </th>
              {rounds.map((col) => (
                <th
                  key={col.round}
                  className="min-w-[4.75rem] px-2 py-2 text-right font-medium text-zinc-500"
                >
                  <span className="block whitespace-nowrap text-xs leading-tight">
                    {col.dateLabel}
                  </span>
                  <span className="block whitespace-nowrap text-xs leading-tight tabular-nums">
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
                  {row.teamName}
                </td>
                <td
                  className={`${stickyCell} left-[10.25rem] text-right tabular-nums`}
                >
                  {row.vpTotal}
                </td>
                {row.cells.map((cell, index) => (
                  <td
                    key={rounds[index]?.round ?? index}
                    className={[
                      "px-2 py-1.5 text-right tabular-nums",
                      cell.pairingClass ?? "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {cell.isHome ? <HomeIcon /> : null}
                      {cell.vp != null ? (
                        <span>{cell.vp}</span>
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
