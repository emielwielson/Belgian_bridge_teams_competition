"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { toIntlLocale } from "@/i18n/intl-locale";
import { formatBrussels } from "@/lib/time/brussels";

type ScorableMatch = {
  id: string;
  round: number;
  datetime: string;
  home_team: { name: string };
  away_team: { name: string };
  group_name: string;
  status: "scheduled";
};

type Props = {
  linkedPlayerName: string | null;
};

export function RegularSeasonScoring({ linkedPlayerName }: Props) {
  const t = useTranslations("player");
  const locale = useLocale() as Locale;
  const intlLocale = toIntlLocale(locale);
  const [matches, setMatches] = useState<ScorableMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/matches/scorable");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("loadFailed"));
      setMatches(body.matches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!linkedPlayerName) {
      setLoading(false);
      return;
    }
    load();
  }, [load, linkedPlayerName]);

  if (!linkedPlayerName) {
    return <p className="mt-2 text-sm text-amber-800">{t("notLinked")}</p>;
  }

  if (loading) {
    return <p className="mt-4 text-sm text-zinc-600">{t("loadingMatches")}</p>;
  }

  if (error) {
    return <p className="mt-4 text-sm text-red-600">{error}</p>;
  }

  if (matches.length === 0) {
    return <p className="mt-4 text-sm text-zinc-600">{t("noMatches")}</p>;
  }

  return (
    <ul className="mt-4 flex flex-col gap-3">
      {matches.map((m) => (
        <li key={m.id}>
          <Link
            href={`/matches/${m.id}`}
            className="block rounded-lg border border-zinc-200 bg-white px-4 py-4 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {t("matchCard", { groupName: m.group_name, round: m.round })}
            </span>
            <span className="mt-1 block text-base font-semibold text-zinc-900">
              {t("matchVs", {
                homeTeam: m.home_team.name,
                awayTeam: m.away_team.name,
              })}
            </span>
            <span className="mt-1 block text-sm text-zinc-600">
              {formatBrussels(m.datetime, intlLocale)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
