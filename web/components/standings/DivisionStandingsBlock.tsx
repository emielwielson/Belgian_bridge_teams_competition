import Link from "next/link";
import type { LeagueStandingsDivision } from "@/lib/competition/standings-queries";
import { StandingsTable } from "./StandingsTable";

type Props = {
  division: LeagueStandingsDivision;
};

export function DivisionStandingsBlock({ division }: Props) {
  const showGroupNames = division.groups.length > 1;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-zinc-900">{division.name}</h2>
      {division.groups.length === 0 ? (
        <StandingsTable rows={[]} />
      ) : (
        division.groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-2">
            {showGroupNames ? (
              <h3 className="text-sm font-medium text-zinc-600">
                <Link
                  href={`/standings/group/${group.id}`}
                  className="hover:text-zinc-900"
                >
                  {group.name}
                </Link>
              </h3>
            ) : null}
            <StandingsTable rows={group.standings} />
          </div>
        ))
      )}
    </section>
  );
}
