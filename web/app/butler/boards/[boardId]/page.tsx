import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HandDiagram } from "@/components/boards/HandDiagram";
import type { BoardHands } from "@/lib/boards/types";
import { formatContract, formatImps } from "@/lib/butler/format";
import { createPublicClient } from "@/lib/supabase/server-client";

export default async function ButlerBoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const t = await getTranslations("butler");
  const { boardId } = await params;
  const client = createPublicClient();

  const { data: board } = await client
    .from("honor_boards")
    .select(
      "id, board_number, dealer, vulnerability, hands, tournament_round, ns_datum, ew_datum, publication_status, group_id",
    )
    .eq("id", boardId)
    .maybeSingle();

  if (!board || board.publication_status !== "published") notFound();

  const { data: results } = await client
    .from("honor_board_results")
    .select(
      "id, room, ns_score, score_diff, ns_butler_imps, ew_butler_imps, contract_level, contract_denomination, doubling, declarer, tricks_result, ns_combination_id, ew_combination_id, match_id",
    )
    .eq("board_id", boardId)
    .eq("processing_status", "published");

  const comboIds = [
    ...new Set(
      (results ?? []).flatMap((r) =>
        [r.ns_combination_id, r.ew_combination_id].filter(Boolean),
      ),
    ),
  ] as string[];

  const { data: combos } = comboIds.length
    ? await client
        .from("honor_player_combinations")
        .select("id, display_name")
        .in("id", comboIds)
    : { data: [] };
  const comboNames = new Map(
    (combos ?? []).map((c) => [c.id as string, c.display_name as string]),
  );

  return (
    <main className="page-container max-w-5xl">
      <p className="text-sm">
        <Link
          href={`/butler/rounds/${board.tournament_round}`}
          className="text-zinc-600 hover:underline"
        >
          {t("backRound")}
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        {t("dealTitle", { board: board.board_number })}
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div>
          {board.hands ? (
            <HandDiagram
              boardNumber={board.board_number}
              dealer={board.dealer}
              vulnerability={board.vulnerability}
              hands={board.hands as BoardHands}
            />
          ) : (
            <p className="text-sm text-zinc-500">{t("noBoards")}</p>
          )}
        </div>
        <div className="rounded-lg border border-zinc-200 px-4 py-3 text-sm">
          <h2 className="mb-2 font-semibold">{t("datum")}</h2>
          {board.ns_datum != null ? (
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-zinc-500">{t("datumNs")}</dt>
              <dd className="text-right font-mono tabular-nums">
                {board.ns_datum}
              </dd>
              <dt className="text-zinc-500">{t("datumEw")}</dt>
              <dd className="text-right font-mono tabular-nums">
                {board.ew_datum}
              </dd>
            </dl>
          ) : (
            <p className="text-zinc-500">{t("datumMissing")}</p>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">{t("fieldComparison")}</h2>
        {(results ?? []).length === 0 ? (
          <p className="text-sm text-zinc-600">{t("noResults")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Room</th>
                  <th className="px-3 py-2 font-medium">{t("contract")}</th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("scoreNs")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("nsImps")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("ewImps")}
                  </th>
                  <th className="px-3 py-2 font-medium">{t("ns")}</th>
                  <th className="px-3 py-2 font-medium">{t("ew")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(results ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 capitalize">{r.room}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {formatContract({
                        contractLevel: r.contract_level,
                        contractDenomination: r.contract_denomination,
                        doubling: r.doubling,
                        declarer: r.declarer,
                        tricksResult: r.tricks_result,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.ns_score ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatImps(
                        r.ns_butler_imps != null
                          ? Number(r.ns_butler_imps)
                          : null,
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatImps(
                        r.ew_butler_imps != null
                          ? Number(r.ew_butler_imps)
                          : null,
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.ns_combination_id
                        ? comboNames.get(r.ns_combination_id) ?? "—"
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.ew_combination_id
                        ? comboNames.get(r.ew_combination_id) ?? "—"
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
