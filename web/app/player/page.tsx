import Link from "next/link";
import { redirect } from "next/navigation";
import { loadUpcomingMatchesForUser } from "@/lib/competition/player-matches";
import { formatBrussels } from "@/lib/time/brussels";
import { createSessionClient } from "@/lib/supabase/server-client";

export default async function PlayerPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/player");
  }

  const matches = await loadUpcomingMatchesForUser(supabase, user.id);

  const { data: player } = await supabase
    .from("players")
    .select("id, name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return (
    <main className="page-container">
      <h1 className="text-2xl font-semibold text-zinc-900">Player</h1>
      {player ? (
        <p className="mt-1 text-sm text-zinc-600">Signed in as {player.name}</p>
      ) : (
        <p className="mt-2 text-sm text-amber-800">
          Your account is not linked to a player profile yet. Ask your club
          manager to link your user to your player record.
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium text-zinc-900">Upcoming matches</h2>
        {matches.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No unscored matches found.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {matches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/player/matches/${m.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50"
                >
                  <span className="font-medium text-zinc-900">
                    Round {m.round}: {m.home_team.name} vs {m.away_team.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {formatBrussels(m.datetime)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
