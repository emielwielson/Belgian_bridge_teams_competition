import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server-client";

type Props = { params: Promise<{ groupId: string }> };

export default async function GroupStandingsPage({ params }: Props) {
  const { groupId } = await params;
  const supabase = await createSessionClient();

  const { data: standings } = await supabase
    .from("standings_group")
    .select("team_name, vp_total")
    .eq("group_id", groupId)
    .order("vp_total", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-8">
      <header>
        <Link href="/standings" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← All groups
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Group standings</h1>
      </header>
      {!standings?.length ? (
        <p className="text-sm text-zinc-500">No scored matches yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">Team</th>
              <th className="py-2 text-right">VP</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, index) => (
              <tr key={row.team_name} className="border-b border-zinc-100">
                <td className="py-2 pr-4 text-zinc-500">{index + 1}</td>
                <td className="py-2 pr-4 font-medium">{row.team_name}</td>
                <td className="py-2 text-right tabular-nums">{row.vp_total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
