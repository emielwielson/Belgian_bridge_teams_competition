import Link from "next/link";
import { loadActiveSeasonLeagues } from "@/lib/competition/standings-queries";
import { createSessionClient } from "@/lib/supabase/server-client";

export default async function StandingsPage() {
  const supabase = await createSessionClient();
  const leagues = await loadActiveSeasonLeagues(supabase);

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Standings</h1>
        <p className="mt-1 text-sm text-zinc-600">Choose a league</p>
      </header>
      {leagues.length === 0 ? (
        <p className="text-sm text-zinc-500">No leagues in the active season yet.</p>
      ) : (
        <nav className="flex flex-col gap-3">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/standings/league/${league.id}`}
              className="card font-medium hover:border-zinc-400"
            >
              {league.name}
            </Link>
          ))}
        </nav>
      )}
    </main>
  );
}
