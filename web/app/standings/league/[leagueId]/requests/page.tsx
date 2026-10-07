import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  getCachedLeagueArbiterRequests,
  getCachedLeagueStandings,
} from "@/lib/competition/standings-cache";
import { createOperationalSignedUrl } from "@/lib/files/operational-file-storage";
import { translateLeagueName } from "@/lib/i18n/labels";
import { createServiceClient } from "@/lib/supabase/server-client";
import { formatBrussels } from "@/lib/time/brussels";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { Locale } from "@/i18n/config";

type Props = { params: Promise<{ leagueId: string }> };

export default async function LeagueArbiterRequestsPage({ params }: Props) {
  const { leagueId } = await params;
  const [t, tRegions] = await Promise.all([
    getTranslations("standings.leagueRequests"),
    getTranslations("regions"),
  ]);
  const locale = (await getLocale()) as Locale;
  const intlLocale = toIntlLocale(locale);

  const [leagueData, requests] = await Promise.all([
    getCachedLeagueStandings(leagueId),
    getCachedLeagueArbiterRequests(leagueId),
  ]);

  if (!leagueData || requests == null) {
    notFound();
  }

  const leagueName = translateLeagueName(leagueData.league.name, tRegions);
  const service = createServiceClient();

  const requestsWithUrls = await Promise.all(
    requests.map(async (request) => {
      if (!request.ruling_file_path) {
        return { ...request, ruling_signed_url: null };
      }
      try {
        const ruling_signed_url = await createOperationalSignedUrl(
          service,
          request.ruling_file_path,
        );
        return { ...request, ruling_signed_url };
      } catch {
        return { ...request, ruling_signed_url: null };
      }
    }),
  );

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href={`/standings/league/${leagueId}`} className="link-back">
          {t("backToLeague", { leagueName })}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
      </header>

      {requestsWithUrls.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {requestsWithUrls.map((request) => (
            <li key={request.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">
                    {t("matchLine", {
                      groupName: request.group_name,
                      round: request.round,
                      homeTeam: request.home_team_name,
                      awayTeam: request.away_team_name,
                    })}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    <span
                      className={
                        request.status === "resolved"
                          ? "font-medium text-emerald-800"
                          : "font-medium text-amber-700"
                      }
                    >
                      {request.status === "resolved"
                        ? t("statusResolved")
                        : t("statusOpen")}
                    </span>
                    {" · "}
                    {t("submitted", {
                      datetime: formatBrussels(request.created_at, intlLocale),
                    })}
                    {request.resolved_at
                      ? ` · ${t("resolved", {
                          datetime: formatBrussels(
                            request.resolved_at,
                            intlLocale,
                          ),
                        })}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/matches/${request.match_id}`}
                    className="btn-secondary px-3 py-1.5 text-sm"
                  >
                    {t("openMatch")}
                  </Link>
                  {request.ruling_signed_url ? (
                    <a
                      href={request.ruling_signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary px-3 py-1.5 text-sm"
                    >
                      {t("viewRuling")}
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
