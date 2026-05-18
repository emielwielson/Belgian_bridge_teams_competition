import type { TeamRosterPlayer } from "@/lib/competition/team-queries";

type Props = {
  roster: TeamRosterPlayer[];
  captainId: string | null;
};

export function TeamRosterList({ roster, captainId }: Props) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Players</h2>
      {roster.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No players on the roster yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {roster.map((player) => (
            <li
              key={player.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-zinc-100 px-3 py-2 text-sm"
            >
              <span className="font-medium text-zinc-900">
                {player.name}
                {player.id === captainId ? (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    Captain
                  </span>
                ) : null}
              </span>
              {player.member_number ? (
                <span className="text-zinc-600 tabular-nums">{player.member_number}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
