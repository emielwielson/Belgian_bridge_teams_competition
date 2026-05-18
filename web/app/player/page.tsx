import { redirect } from "next/navigation";
import { RegularSeasonScoring } from "@/components/player/RegularSeasonScoring";
import { createSessionClient } from "@/lib/supabase/server-client";

export default async function PlayerPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/player");
  }

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
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-medium text-zinc-900">Score a match</h2>
        <RegularSeasonScoring linkedPlayerName={player?.name ?? null} />
      </section>
    </main>
  );
}
