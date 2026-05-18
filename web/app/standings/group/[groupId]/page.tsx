import Link from "next/link";
import { notFound } from "next/navigation";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { loadGroupStandings } from "@/lib/competition/standings-queries";
import { createSessionClient } from "@/lib/supabase/server-client";

type Props = { params: Promise<{ groupId: string }> };

export default async function GroupStandingsPage({ params }: Props) {
  const { groupId } = await params;
  const supabase = await createSessionClient();
  const data = await loadGroupStandings(supabase, groupId);

  if (!data) {
    notFound();
  }

  const { group, division, league, standings } = data;

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
      <StandingsTable rows={standings} />
    </main>
  );
}
