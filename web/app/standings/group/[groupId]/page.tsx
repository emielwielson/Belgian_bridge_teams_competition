import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  GroupDisciplineSections,
  GroupDisciplineSectionsFallback,
} from "@/components/standings/GroupDisciplineSections";
import { GroupStandingsGrid } from "@/components/standings/GroupStandingsGrid";
import { buildGroupStandingsGrid } from "@/lib/competition/group-standings-grid";
import { getCachedGroupStandingsGrid } from "@/lib/competition/standings-cache";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { Locale } from "@/i18n/config";

type Props = { params: Promise<{ groupId: string }> };

export default async function GroupStandingsPage({ params }: Props) {
  const { groupId } = await params;
  const t = await getTranslations("standings");
  const tTable = await getTranslations("standings.table");
  const locale = (await getLocale()) as Locale;
  const intlLocale = toIntlLocale(locale);
  const data = await getCachedGroupStandingsGrid(groupId);

  if (!data) {
    notFound();
  }

  const { group, division, league, standings, matches, byeRounds } = data;
  const grid = buildGroupStandingsGrid(
    standings,
    matches,
    byeRounds,
    intlLocale,
  );

  const tableLabels = {
    rank: tTable("rank"),
    team: tTable("team"),
    vp: tTable("vp"),
    penaltyShort: tTable("penaltyShort"),
    noTeamsInGroup: tTable("noTeamsInGroup"),
    roundColumnsPending: tTable("roundColumnsPending"),
    viewMatchAria: tTable("viewMatchAria"),
    homeAria: tTable("homeAria"),
  };

  return (
    <main className="page-container-full flex min-h-0 flex-1 flex-col gap-4 sm:gap-6">
      <header>
        <Link
          href={`/standings/league/${league.id}`}
          className="link-back"
        >
          {t("backToLeagueStandings", { leagueName: league.name })}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{group.name}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {t("breadcrumb", {
            leagueName: league.name,
            divisionName: division.name,
          })}
        </p>
      </header>
      <GroupStandingsGrid grid={grid} labels={tableLabels} />
      <Suspense fallback={<GroupDisciplineSectionsFallback />}>
        <GroupDisciplineSections groupId={groupId} />
      </Suspense>
    </main>
  );
}
