import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { GroupPenaltiesSection } from "@/components/standings/GroupPenaltiesSection";
import { GroupRulingsSection } from "@/components/standings/GroupRulingsSection";
import { GroupStandingsGrid } from "@/components/standings/GroupStandingsGrid";
import { buildGroupStandingsGrid } from "@/lib/competition/group-standings-grid";
import { loadGroupStandingsFull } from "@/lib/competition/standings-queries";
import { createOperationalSignedUrl } from "@/lib/files/operational-file-storage";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { Locale } from "@/i18n/config";
import { createServiceClient, createSessionClient } from "@/lib/supabase/server-client";

type Props = { params: Promise<{ groupId: string }> };

export default async function GroupStandingsPage({ params }: Props) {
  const { groupId } = await params;
  const t = await getTranslations("standings");
  const locale = (await getLocale()) as Locale;
  const intlLocale = toIntlLocale(locale);
  const supabase = await createSessionClient();
  const data = await loadGroupStandingsFull(supabase, groupId);

  if (!data) {
    notFound();
  }

  const { group, division, league, standings, matches, byeRounds, penalties, rulings } =
    data;
  const grid = buildGroupStandingsGrid(
    standings,
    matches,
    byeRounds,
    intlLocale,
  );

  const service = createServiceClient();
  const penaltiesWithUrls = await Promise.all(
    penalties.map(async (penalty) => {
      if (!penalty.file_path) return { ...penalty, signed_url: null };
      try {
        const signed_url = await createOperationalSignedUrl(
          service,
          penalty.file_path,
        );
        return { ...penalty, signed_url };
      } catch {
        return { ...penalty, signed_url: null };
      }
    }),
  );

  const rulingsWithUrls = await Promise.all(
    rulings.map(async (ruling) => {
      try {
        const signed_url = await createOperationalSignedUrl(
          service,
          ruling.file_path,
        );
        return { ...ruling, signed_url };
      } catch {
        return { ...ruling, signed_url: null };
      }
    }),
  );

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
      <GroupStandingsGrid grid={grid} />
      <GroupPenaltiesSection penalties={penaltiesWithUrls} />
      <GroupRulingsSection rulings={rulingsWithUrls} />
    </main>
  );
}
