import type { GroupRulingRow } from "@/lib/competition/standings-queries";

type Props = {
  rulings: GroupRulingRow[];
};

export function GroupRulingsSection({ rulings }: Props) {
  if (rulings.length === 0) return null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-zinc-900">Rulings</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Official arbiter rulings for matches in this group.
      </p>
      <ul className="mt-4 divide-y divide-zinc-100">
        {rulings.map((ruling) => {
          const m = ruling.match;
          const matchLabel = m
            ? `Round ${m.round}: ${m.home_team?.name ?? "?"} vs ${m.away_team?.name ?? "?"}`
            : "Match";
          return (
            <li key={ruling.id} className="py-3 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">{matchLabel}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {ruling.ruling_date ?? "—"}
                    {ruling.board != null ? ` · Board ${ruling.board}` : ""}
                    {ruling.arbiter_request_id ? " · From arbiter request" : ""}
                  </p>
                </div>
                {ruling.signed_url ? (
                  <a
                    href={ruling.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-emerald-800 underline"
                  >
                    View ruling
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
