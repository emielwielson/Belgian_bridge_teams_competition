import type { TeamDetail } from "@/lib/competition/team-queries";

type Props = Pick<
  TeamDetail,
  "team" | "captain" | "club" | "group" | "division" | "league"
>;

export function TeamInfoSection({
  team,
  captain,
  club,
  group,
  division,
  league,
}: Props) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-600">
        {[league.name, division.name, group.name].join(" · ")}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">{team.name}</h1>
      <p className="mt-1 text-sm text-zinc-600">{club.name}</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-zinc-500">Captain</dt>
          <dd className="mt-0.5 text-zinc-900">
            {captain ? (
              <>
                {captain.name}
                {captain.member_number ? (
                  <span className="text-zinc-600"> · {captain.member_number}</span>
                ) : null}
              </>
            ) : (
              <span className="text-zinc-500">Not set</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500">Location</dt>
          <dd className="mt-0.5 text-zinc-900">
            {team.location?.trim() ? team.location : (
              <span className="text-zinc-500">Not set</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
