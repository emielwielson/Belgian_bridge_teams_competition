import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { loadActiveSeasonLeagues } from "@/lib/competition/standings-queries";
import { createSessionClient } from "@/lib/supabase/server-client";

type Props = {
  showForbidden?: boolean;
};

export async function StandingsHome({ showForbidden = false }: Props) {
  const [t, tHome] = await Promise.all([
    getTranslations("standings"),
    getTranslations("home"),
  ]);
  const supabase = await createSessionClient();
  const leagues = await loadActiveSeasonLeagues(supabase);

  return (
    <main className="page-container flex flex-col gap-6">
      {showForbidden ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {tHome("forbidden")}
        </p>
      ) : null}
      <header>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("chooseLeague")}</p>
      </header>
      {leagues.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("noLeagues")}</p>
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
