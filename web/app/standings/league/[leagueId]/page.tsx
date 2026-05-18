import Link from "next/link";
import { notFound } from "next/navigation";
import { DivisionStandingsBlock } from "@/components/standings/DivisionStandingsBlock";
import { loadLeagueStandings } from "@/lib/competition/standings-queries";
import { createSessionClient } from "@/lib/supabase/server-client";

type Props = { params: Promise<{ leagueId: string }> };

export default async function LeagueStandingsPage({ params }: Props) {
  const { leagueId } = await params;
  const supabase = await createSessionClient();
  const data = await loadLeagueStandings(supabase, leagueId);

  if (!data) {
    notFound();
  }

  const { league, divisions } = data;

  return (
    <main className="page-container flex flex-col gap-8">
      <header>
        <Link href="/standings" className="link-back">
          ← Standings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{league.name}</h1>
        <p className="mt-1 text-sm text-zinc-600">Division standings</p>
      </header>
      {divisions.length === 0 ? (
        <p className="text-sm text-zinc-500">No divisions in this league yet.</p>
      ) : (
        divisions.map((division) => (
          <DivisionStandingsBlock key={division.id} division={division} />
        ))
      )}
    </main>
  );
}
