"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { TeamMatchRow } from "@/lib/competition/team-queries";
import { formatBrussels } from "@/lib/time/brussels";

type Props = {
  teamName: string;
  matches: TeamMatchRow[];
};

export function TeamMatchesList({ teamName, matches }: Props) {
  const t = useTranslations("team");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const intlLocale = toIntlLocale(locale);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">{t("matchesTitle")}</h2>
      {matches.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          {t("noMatches", { teamName })}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {matches.map((match) => (
            <li key={match.id}>
              <Link
                href={`/matches/${match.id}`}
                className="block rounded-md border border-zinc-100 px-3 py-3 text-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-zinc-900">
                  {t("round", { round: match.round })}
                </span>
                <span
                  className={
                    match.status === "played"
                      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                      : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
                  }
                >
                  {match.status === "played" ? tc("played") : tc("scheduled")}
                </span>
              </div>
              <p className="mt-1 text-zinc-600">
                {formatBrussels(match.datetime, intlLocale)}
              </p>
              <p className="mt-1 text-zinc-900">
                {match.isHome
                  ? t("homeVs", { opponent: match.opponent.name })
                  : t("awayAt", { opponent: match.opponent.name })}
              </p>
              {match.status === "played" &&
              match.teamVp != null &&
              match.opponentVp != null ? (
                <p className="mt-1 tabular-nums text-emerald-700">
                  {t("vpLine", {
                    teamVp: match.teamVp,
                    opponentVp: match.opponentVp,
                  })}
                </p>
              ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
