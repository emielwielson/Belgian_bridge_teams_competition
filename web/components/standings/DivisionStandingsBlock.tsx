"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { LeagueStandingsDivision } from "@/lib/competition/standings-queries";
import { StandingsTable } from "./StandingsTable";

type Props = {
  division: LeagueStandingsDivision;
};

export function DivisionStandingsBlock({ division }: Props) {
  const t = useTranslations("standings");
  const showGroupNames = division.groups.length > 1;
  const fullStandingsGroup =
    division.groups.length === 1 ? division.groups[0] : null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">{division.name}</h2>
        {fullStandingsGroup ? (
          <Link
            href={`/standings/group/${fullStandingsGroup.id}`}
            className="btn-secondary shrink-0 px-3 py-1.5 text-sm"
          >
            {t("fullStandings")}
          </Link>
        ) : null}
      </div>
      {division.groups.length === 0 ? (
        <StandingsTable rows={[]} />
      ) : (
        division.groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-2">
            {showGroupNames ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-zinc-600">{group.name}</h3>
                <Link
                  href={`/standings/group/${group.id}`}
                  className="btn-secondary shrink-0 px-3 py-1.5 text-sm"
                >
                  {t("fullStandings")}
                </Link>
              </div>
            ) : null}
            <StandingsTable rows={group.standings} />
          </div>
        ))
      )}
    </section>
  );
}
