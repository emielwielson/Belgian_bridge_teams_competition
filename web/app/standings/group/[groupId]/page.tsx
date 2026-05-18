import Link from "next/link";
import { notFound } from "next/navigation";
import { GroupStandingsGrid } from "@/components/standings/GroupStandingsGrid";
import { buildGroupStandingsGrid } from "@/lib/competition/group-standings-grid";
import { loadGroupStandingsFull } from "@/lib/competition/standings-queries";
import { createSessionClient } from "@/lib/supabase/server-client";

type Props = { params: Promise<{ groupId: string }> };

export default async function GroupStandingsPage({ params }: Props) {
  const { groupId } = await params;
  const supabase = await createSessionClient();
  const data = await loadGroupStandingsFull(supabase, groupId);

  if (!data) {
    notFound();
  }

  const { group, division, league, standings, matches } = data;
  const grid = buildGroupStandingsGrid(standings, matches);

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link
          href={`/standings/league/${league.id}`}
          className="link-back"
        >
          ← {league.name} standings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{group.name}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {[league.name, division.name].join(" · ")}
        </p>
      </header>
      <GroupStandingsGrid grid={grid} />
    </main>
  );
}
