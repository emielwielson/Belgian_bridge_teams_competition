import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DivisionStandingsBlock } from "@/components/standings/DivisionStandingsBlock";
import { getCachedLeagueStandings } from "@/lib/competition/standings-cache";
import { translateLeagueName } from "@/lib/i18n/labels";

type Props = { params: Promise<{ leagueId: string }> };

export default async function LeagueStandingsPage({ params }: Props) {
  const { leagueId } = await params;
  const [t, tTable, tRegions] = await Promise.all([
    getTranslations("standings"),
    getTranslations("standings.table"),
    getTranslations("regions"),
  ]);
  const data = await getCachedLeagueStandings(leagueId);

  if (!data) {
    notFound();
  }

  const { league, divisions } = data;
  const leagueName = translateLeagueName(league.name, tRegions);

  const tableLabels = {
    rank: tTable("rank"),
    team: tTable("team"),
    vp: tTable("vp"),
    empty: tTable("empty"),
  };

  return (
    <main className="page-container flex flex-col gap-8">
      <header>
        <Link href="/" className="link-back">
          {t("backToStandings")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{leagueName}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("divisionStandings")}</p>
      </header>
      {divisions.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("noDivisions")}</p>
      ) : (
        divisions.map((division) => (
          <DivisionStandingsBlock
            key={division.id}
            division={division}
            fullStandingsLabel={t("fullStandings")}
            tableLabels={tableLabels}
          />
        ))
      )}
    </main>
  );
}
