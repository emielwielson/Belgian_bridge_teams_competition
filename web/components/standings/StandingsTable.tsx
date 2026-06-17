import Link from "next/link";

export type StandingsTableRow = {
  team_id?: string;
  team_name: string;
  vp_total: number;
};

export type StandingsTableLabels = {
  rank: string;
  team: string;
  vp: string;
  empty: string;
};

type Props = {
  rows: StandingsTableRow[];
  labels: StandingsTableLabels;
  emptyMessage?: string;
};

export function StandingsTable({ rows, labels, emptyMessage }: Props) {
  const empty = emptyMessage ?? labels.empty;

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-zinc-500">
          <th className="py-2 pr-4">{labels.rank}</th>
          <th className="py-2 pr-4">{labels.team}</th>
          <th className="py-2 text-right">{labels.vp}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={row.team_id ?? row.team_name}
            className="border-b border-zinc-100"
          >
            <td className="py-2 pr-4 text-zinc-500">{index + 1}</td>
            <td className="py-2 pr-4 font-medium">
              {row.team_id ? (
                <Link
                  href={`/teams/${row.team_id}`}
                  className="hover:text-emerald-800 hover:underline"
                >
                  {row.team_name}
                </Link>
              ) : (
                row.team_name
              )}
            </td>
            <td className="py-2 text-right tabular-nums">{row.vp_total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
