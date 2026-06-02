import type { GroupPenaltyRow } from "@/lib/competition/standings-queries";

type Props = {
  penalties: (GroupPenaltyRow & { signed_url?: string | null })[];
};

export function GroupPenaltiesSection({ penalties }: Props) {
  if (penalties.length === 0) return null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-zinc-900">Penalties</h2>
      <p className="mt-1 text-sm text-zinc-600">
        VP deductions applied to teams in this group.
      </p>
      <ul className="mt-4 divide-y divide-zinc-100">
        {penalties.map((penalty) => (
          <li key={penalty.id} className="py-3 first:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-zinc-900">
                  {penalty.team?.name ?? "Team"} · −{penalty.vp_deduction} VP
                </p>
                <p className="mt-1 text-sm text-zinc-600">{penalty.reason}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {penalty.penalty_date}
                </p>
              </div>
              {penalty.signed_url ? (
                <a
                  href={penalty.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-emerald-800 underline"
                >
                  View document
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
