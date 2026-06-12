"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { PlayerTeamAppearance } from "@/lib/competition/player-queries";

type Props = {
  appearances: PlayerTeamAppearance[];
};

export function PlayerTeamAppearancesTable({ appearances }: Props) {
  const t = useTranslations("players");

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-zinc-900">{t("appearancesTitle")}</h2>
      <p className="mt-1 text-sm text-zinc-600">{t("appearancesDescription")}</p>

      {appearances.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{t("noAppearances")}</p>
      ) : (
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 pr-4">{t("table.team")}</th>
              <th className="py-2 pr-4 text-right">{t("table.matchesPlayed")}</th>
              <th className="py-2 text-right">{t("table.matchesAsSub")}</th>
            </tr>
          </thead>
          <tbody>
            {appearances.map((row) => (
              <tr key={row.team_id} className="border-b border-zinc-100">
                <td className="py-2 pr-4 font-medium">
                  <Link
                    href={`/teams/${row.team_id}`}
                    className="hover:text-emerald-800 hover:underline"
                  >
                    {row.team_name}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {row.matches_played}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {row.matches_as_sub}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
