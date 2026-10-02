import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { PlayerMatchSummary } from "@/lib/competition/player-matches";
import { formatBrussels } from "@/lib/time/brussels";

type Props = {
  match: PlayerMatchSummary;
};

export async function TeamNextMatchLink({ match }: Props) {
  const [t, locale] = await Promise.all([
    getTranslations("team"),
    getLocale(),
  ]);
  const intlLocale = toIntlLocale(locale as Locale);

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
