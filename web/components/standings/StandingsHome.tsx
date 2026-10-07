import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NextMatchButton } from "@/components/standings/NextMatchButton";
import { translateLeagueName } from "@/lib/i18n/labels";
import {
  loadNextUnplayedMatchForTeam,
  type PlayerMatchSummary,
} from "@/lib/competition/player-matches";
import { loadActiveSeasonLeagues } from "@/lib/competition/standings-queries";
import { loadTeamsForUser } from "@/lib/competition/team-queries";
import { createSessionClient } from "@/lib/supabase/server-client";

type Props = {
  showForbidden?: boolean;
};

export async function StandingsHome({ showForbidden = false }: Props) {
  const [t, tHome, tRegions] = await Promise.all([
    getTranslations("standings"),
    getTranslations("home"),
    getTranslations("regions"),
  ]);
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [leagues, teams] = await Promise.all([
    loadActiveSeasonLeagues(supabase),
    user ? loadTeamsForUser(supabase, user.id) : Promise.resolve([]),
  ]);

  const nextByTeamId: Record<string, PlayerMatchSummary | null> = {};
  if (teams.length > 0) {
    const nextMatches = await Promise.all(
      teams.map(async (team) => {
        const next = await loadNextUnplayedMatchForTeam(supabase, team.id);
        return [team.id, next] as const;
      }),
    );
    for (const [teamId, next] of nextMatches) {
      nextByTeamId[teamId] = next;
    }
  }

  return (
    <main className="page-container flex flex-col gap-6">
      {showForbidden ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {tHome("forbidden")}
        </p>
      ) : null}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-600">{t("chooseLeague")}</p>
        </div>
        {teams.length > 0 ? (
          <NextMatchButton teams={teams} nextByTeamId={nextByTeamId} />
        ) : null}
      </header>
      {leagues.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("noLeagues")}</p>
      ) : (
        <nav className="flex flex-col gap-3">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/standings/league/${league.id}`}
              className="card-interactive"
            >
              {translateLeagueName(league.name, tRegions)}
            </Link>
          ))}
        </nav>
      )}
    </main>
  );
}
