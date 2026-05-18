export type StandingsTableRow = {
  team_name: string;
  vp_total: number;
};

type Props = {
  rows: StandingsTableRow[];
  emptyMessage?: string;
};

export function StandingsTable({
  rows,
  emptyMessage = "No scored matches yet.",
}: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMessage}</p>;
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-zinc-500">
          <th className="py-2 pr-4">#</th>
          <th className="py-2 pr-4">Team</th>
          <th className="py-2 text-right">VP</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.team_name} className="border-b border-zinc-100">
            <td className="py-2 pr-4 text-zinc-500">{index + 1}</td>
            <td className="py-2 pr-4 font-medium">{row.team_name}</td>
            <td className="py-2 text-right tabular-nums">{row.vp_total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
