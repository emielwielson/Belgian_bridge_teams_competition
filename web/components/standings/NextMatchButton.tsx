"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { toIntlLocale } from "@/i18n/intl-locale";
import { resolveActiveTeamId } from "@/lib/auth/active-team";
import type { PlayerMatchSummary } from "@/lib/competition/player-matches";
import { formatBrussels } from "@/lib/time/brussels";

type NextMatchLinkProps = {
  match: PlayerMatchSummary;
};

export function NextMatchLink({ match }: NextMatchLinkProps) {
  const t = useTranslations("home");
  const locale = useLocale() as Locale;
  const intlLocale = toIntlLocale(locale);

  return (
    <Link
      href={`/matches/${match.id}`}
      className="btn-primary flex w-fit shrink-0 flex-col items-start gap-0.5 px-4 py-3 text-left"
    >
      <span className="font-semibold">{t("nextMatch")}</span>
      <span className="text-sm font-normal opacity-90">
        {t("nextMatchVs", {
          homeTeam: match.home_team.name,
          awayTeam: match.away_team.name,
        })}
      </span>
      <span className="text-xs font-normal opacity-80">
        {formatBrussels(match.datetime, intlLocale)}
      </span>
    </Link>
  );
}

type NextMatchButtonProps = {
  teams: ReadonlyArray<{ id: string }>;
  nextByTeamId: Record<string, PlayerMatchSummary | null>;
};

export function NextMatchButton({ teams, nextByTeamId }: NextMatchButtonProps) {
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTeamId(resolveActiveTeamId(teams));
  }, [teams]);

  const nextMatch = activeTeamId ? nextByTeamId[activeTeamId] : null;
  if (!nextMatch) return null;

  return <NextMatchLink match={nextMatch} />;
}
