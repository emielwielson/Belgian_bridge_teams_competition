"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { TeamDetail } from "@/lib/competition/team-queries";
import { translateLeagueName } from "@/lib/i18n/labels";

type Props = Pick<
  TeamDetail,
  "team" | "captain" | "club" | "group" | "division" | "league"
> & {
  canLinkToPlayers: boolean;
};

export function TeamInfoSection({
  team,
  captain,
  club,
  group,
  division,
  league,
  canLinkToPlayers,
}: Props) {
  const t = useTranslations("team");
  const tRegions = useTranslations("regions");
  const leagueName = translateLeagueName(league.name, tRegions);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-600">
        {[leagueName, division.name, group.name].join(" · ")}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">{team.name}</h1>
      <p className="mt-1 text-sm text-zinc-600">{club.name}</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-zinc-500">{t("captain")}</dt>
          <dd className="mt-0.5 text-zinc-900">
            {captain ? (
              <>
                {canLinkToPlayers ? (
                  <Link
                    href={`/players/${captain.id}?from=/teams/${team.id}`}
                    className="hover:text-emerald-800 hover:underline"
                  >
                    {captain.name}
                  </Link>
                ) : (
                  captain.name
                )}
                {captain.member_number ? (
                  <span className="text-zinc-600"> · {captain.member_number}</span>
                ) : null}
              </>
            ) : (
              <span className="text-zinc-500">{t("captainNotSet")}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500">{t("location")}</dt>
          <dd className="mt-0.5 text-zinc-900">
            {team.location?.trim() ? team.location : (
              <span className="text-zinc-500">{t("locationNotSet")}</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
