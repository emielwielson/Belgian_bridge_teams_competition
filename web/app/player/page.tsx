import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { RegularSeasonScoring } from "@/components/player/RegularSeasonScoring";
import { getActivePlayer } from "@/lib/auth/active-player";
import { loadTeamsForUser } from "@/lib/competition/team-queries";
import { createSessionClient } from "@/lib/supabase/server-client";

export default async function PlayerPage() {
  const t = await getTranslations("player");
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/player");
  }

  const player = await getActivePlayer(supabase, user.id);

  const teams = await loadTeamsForUser(supabase, user.id);

  return (
    <main className="page-container">
      <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
      {player ? (
        <p className="mt-1 text-sm text-zinc-600">
          {t("signedInAs", { playerName: player.name })}
        </p>
      ) : null}

      {teams.length > 0 ? (
        <section className="mt-4 flex flex-col gap-2">
          {teams.length === 1 ? (
            <Link
              href={`/teams/${teams[0].id}`}
              className="btn-primary w-fit"
            >
              {t("myTeamButton", { teamName: teams[0].name })}
            </Link>
          ) : (
            <>
              <p className="text-sm font-medium text-zinc-900">{t("myTeams")}</p>
              <ul className="flex flex-col gap-2">
                {teams.map((team) => (
                  <li key={team.id}>
                    <Link
                      href={`/teams/${team.id}`}
                      className="btn-secondary inline-block w-fit px-3 py-1.5 text-sm"
                    >
                      {team.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-medium text-zinc-900">{t("scoreMatchTitle")}</h2>
        <RegularSeasonScoring linkedPlayerName={player?.name ?? null} />
      </section>
    </main>
  );
}
