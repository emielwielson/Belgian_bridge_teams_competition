import type { TeamMatchRow } from "@/lib/competition/team-queries";
import { formatBrussels } from "@/lib/time/brussels";

type Props = {
  teamName: string;
  matches: TeamMatchRow[];
};

export function TeamMatchesList({ teamName, matches }: Props) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Matches</h2>
      {matches.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          No matches scheduled for {teamName} yet.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {matches.map((match) => (
            <li
              key={match.id}
              className="rounded-md border border-zinc-100 px-3 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-zinc-900">
                  Round {match.round}
                </span>
                <span
                  className={
                    match.status === "played"
                      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                      : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
                  }
                >
                  {match.status === "played" ? "Played" : "Scheduled"}
                </span>
              </div>
              <p className="mt-1 text-zinc-600">{formatBrussels(match.datetime)}</p>
              <p className="mt-1 text-zinc-900">
                {match.isHome ? (
                  <>
                    Home vs <span className="font-medium">{match.opponent.name}</span>
                  </>
                ) : (
                  <>
                    Away at <span className="font-medium">{match.opponent.name}</span>
                  </>
                )}
              </p>
              {match.status === "played" &&
              match.teamVp != null &&
              match.opponentVp != null ? (
                <p className="mt-1 tabular-nums text-emerald-700">
                  VP {match.teamVp} – {match.opponentVp}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
