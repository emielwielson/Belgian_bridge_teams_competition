"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { PlayerDetail } from "@/lib/competition/player-queries";

type Props = Pick<PlayerDetail, "player" | "assigned_team">;

export function PlayerInfoSection({ player, assigned_team }: Props) {
  const t = useTranslations("players");

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h1 className="text-2xl font-semibold text-zinc-900">{player.name}</h1>
      {player.member_number ? (
        <p className="mt-1 text-sm text-zinc-600">
          {t("memberNumber", { number: player.member_number })}
        </p>
      ) : null}
      <dl className="mt-4 text-sm">
        <dt className="font-medium text-zinc-500">{t("assignedTeam")}</dt>
        <dd className="mt-0.5 text-zinc-900">
          {assigned_team ? (
            <Link
              href={`/teams/${assigned_team.id}`}
              className="hover:text-emerald-800 hover:underline"
            >
              {assigned_team.name}
            </Link>
          ) : (
            <span className="text-zinc-500">{t("notAssigned")}</span>
          )}
        </dd>
      </dl>
    </section>
  );
}
