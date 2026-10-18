"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { Locale } from "@/i18n/config";
import type { MissingScoreDivision } from "@/lib/competition/missing-scores";
import { translateDivisionName } from "@/lib/i18n/labels";
import { formatBrussels } from "@/lib/time/brussels";

type Props = {
  divisions: MissingScoreDivision[];
  showGroupColumn: boolean;
};

export function MissingScoresList({ divisions, showGroupColumn }: Props) {
  const t = useTranslations("admin.missingScoresPage");
  const tCommon = useTranslations("common");
  const tDivisions = useTranslations("divisions");
  const locale = useLocale() as Locale;
  const intlLocale = toIntlLocale(locale);

  if (divisions.length === 0) {
    return <p className="text-sm text-zinc-600">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {divisions.map((division) => (
        <section key={division.id}>
          <h2 className="text-lg font-semibold text-zinc-900">
            {translateDivisionName(division.name, tDivisions)}
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <th className="py-2 pr-3">{t("round")}</th>
                  <th className="py-2 pr-3">{t("when")}</th>
                  {showGroupColumn ? (
                    <th className="py-2 pr-3">{t("group")}</th>
                  ) : null}
                  <th className="py-2 pr-3">{t("match")}</th>
                </tr>
              </thead>
              <tbody>
                {division.matches.map((match) => (
                  <tr key={match.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 whitespace-nowrap text-zinc-600">
                      {tCommon("round", { round: match.round })}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-zinc-600">
                      {formatBrussels(match.datetime, intlLocale)}
                    </td>
                    {showGroupColumn ? (
                      <td className="py-2 pr-3 text-zinc-600">
                        {match.groupName}
                      </td>
                    ) : null}
                    <td className="py-2 pr-3">
                      <Link
                        href={`/matches/${match.id}`}
                        className="text-emerald-800 underline"
                      >
                        {match.homeTeam.name} {tCommon("vs")}{" "}
                        {match.awayTeam.name}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
