import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createPublicClient } from "@/lib/supabase/server-client";
import { resolvePublicHonorGroup } from "@/lib/butler/honor-group";
import { getPublishedCombinationStandings } from "@/lib/butler/public-standings";
import { formatImps } from "@/lib/butler/format";

export default async function ButlerOverviewPage() {
  const t = await getTranslations("butler");
  const client = createPublicClient();
  const group = await resolvePublicHonorGroup(client);

  if (!group) {
    return (
      <main className="page-container">
        <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-600">{t("empty")}</p>
      </main>
    );
  }

  const standings = await getPublishedCombinationStandings(client, group.id);

  return (
    <main className="page-container max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-zinc-600">{t("subtitle")}</p>

      {standings.combinations.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600">{t("empty")}</p>
      ) : (
        <div className="mt-8 space-y-10">
          <section>
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("rank")}</th>
                    <th className="px-3 py-2 font-medium">{t("pair")}</th>
                    <th className="px-3 py-2 font-medium">{t("team")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("imps")}</th>
                    <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                      {t("boards")}
                    </th>
                    <th className="hidden px-3 py-2 text-right font-medium md:table-cell">
                      {t("avg")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {standings.combinations.map((row) => (
                    <tr key={row.combinationId} className="hover:bg-zinc-50/80">
                      <td className="px-3 py-2 tabular-nums text-zinc-500">
                        {row.rank}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/butler/pairs/${row.combinationId}`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          {row.displayName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{row.teamName}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatImps(row.totalImps)}
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums text-zinc-500 sm:table-cell">
                        {row.boardsPlayed}
                      </td>
                      <td className="hidden px-3 py-2 text-right font-mono tabular-nums text-zinc-500 md:table-cell">
                        {formatImps(row.averageImps)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              {t("roundMatrix")}
            </h2>
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 font-medium">
                      {t("pair")}
                    </th>
                    {standings.rounds.map((r) => (
                      <th
                        key={r.tournamentRound}
                        className="px-3 py-2 text-right font-medium whitespace-nowrap"
                      >
                        <Link
                          href={`/butler/rounds/${r.tournamentRound}`}
                          className="hover:underline"
                        >
                          R{r.tournamentRound}
                        </Link>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">
                      {t("total")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {standings.combinations.map((row) => (
                    <tr key={row.combinationId}>
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium whitespace-nowrap">
                        {row.displayName}
                      </td>
                      {standings.rounds.map((r) => {
                        const cell =
                          standings.matrix[row.combinationId]?.[
                            r.tournamentRound
                          ];
                        return (
                          <td
                            key={r.tournamentRound}
                            className="px-3 py-2 text-right font-mono tabular-nums"
                          >
                            {cell ? formatImps(cell.imps) : "—"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatImps(row.totalImps)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
