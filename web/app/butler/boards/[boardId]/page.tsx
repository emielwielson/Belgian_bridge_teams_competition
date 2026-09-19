import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HandDiagram } from "@/components/boards/HandDiagram";
import { ContractLabel } from "@/components/butler/ContractLabel";
import { DatumScoreInfo } from "@/components/butler/DatumScoreInfo";
import { LeadLabel } from "@/components/butler/LeadLabel";
import type { BoardHands, Dealer, Vulnerability } from "@/lib/boards/types";
import { handDiagramLabelsFromButler } from "@/lib/boards/hand-diagram-labels";
import { formatImps } from "@/lib/butler/format";
import { formatPairDisplayName } from "@/lib/butler/person-name";
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

  const [{ data: results }, { data: roundBoards }] = await Promise.all([
    client
      .from("honor_board_results")
      .select(
        "id, room, ns_score, score_diff, ns_butler_imps, ew_butler_imps, contract_level, contract_denomination, doubling, declarer, tricks_result, lead_card, ns_combination_id, ew_combination_id, match_id",
      )
      .eq("board_id", boardId)
      .eq("processing_status", "published"),
    client
      .from("honor_boards")
      .select("id, board_number")
      .eq("group_id", board.group_id)
      .eq("tournament_round", board.tournament_round)
      .eq("publication_status", "published")
      .order("board_number"),
  ]);

  const siblings = roundBoards ?? [];
  const currentIndex = siblings.findIndex((b) => b.id === boardId);
  const prevBoard = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextBoard =
    currentIndex >= 0 && currentIndex < siblings.length - 1
      ? siblings[currentIndex + 1]
      : null;

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
    (combos ?? []).map((c) => [
      c.id as string,
      formatPairDisplayName(c.display_name as string),
    ]),
  );

  const dealer = (board.dealer as Dealer | null) ?? null;
  const vulnerability = (board.vulnerability as Vulnerability | null) ?? null;
  const diagramLabels = handDiagramLabelsFromButler(t, {
    dealer,
    vulnerability,
    boardNumber: board.board_number,
  });

  const navLinkClass =
    "rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50";
  const navDisabledClass =
    "rounded-md border border-transparent px-3 py-1.5 text-sm text-zinc-300";

  return (
    <main className="page-container max-w-7xl">
      <p className="text-sm">
        <Link
          href={`/butler/rounds/${board.tournament_round}`}
          className="text-zinc-600 hover:underline"
        >
          {t("backRound", { round: board.tournament_round })}
        </Link>
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {t("dealTitle", { board: board.board_number })}
        </h1>
        <nav className="flex items-center gap-2" aria-label={t("boardNav")}>
          {prevBoard ? (
            <Link
              href={`/butler/boards/${prevBoard.id}`}
              className={navLinkClass}
            >
              ← {t("dealTitle", { board: prevBoard.board_number })}
            </Link>
          ) : (
            <span className={navDisabledClass}>← {t("prevBoard")}</span>
          )}
          {nextBoard ? (
            <Link
              href={`/butler/boards/${nextBoard.id}`}
              className={navLinkClass}
            >
              {t("dealTitle", { board: nextBoard.board_number })} →
            </Link>
          ) : (
            <span className={navDisabledClass}>{t("nextBoard")} →</span>
          )}
        </nav>
      </div>

      {siblings.length > 1 ? (
        <nav
          className="mt-3 flex flex-wrap gap-1.5"
          aria-label={t("boardNav")}
        >
          {siblings.map((b) => {
            const active = b.id === boardId;
            return (
              <Link
                key={b.id}
                href={`/butler/boards/${b.id}`}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-zinc-900 px-2 text-sm font-medium text-white"
                    : "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-zinc-200 px-2 text-sm text-zinc-700 hover:bg-zinc-50"
                }
              >
                {b.board_number}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] lg:items-start">
        <aside>
          {board.hands ? (
            <HandDiagram
              boardNumber={board.board_number}
              dealer={dealer}
              vulnerability={vulnerability}
              hands={board.hands as BoardHands}
              labels={diagramLabels}
              showBoardNumber={false}
            />
          ) : (
            <p className="text-sm text-zinc-500">{t("noBoards")}</p>
          )}
        </aside>

        <section className="min-w-0">
          <h2 className="mb-3 text-lg font-semibold">{t("fieldComparison")}</h2>
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("datum")}
              </h3>
              <DatumScoreInfo
                ariaLabel={t("datumInfoAria")}
                helpText={t("datumHelp")}
              />
            </div>
            {board.ns_datum != null ? (
              <dl className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex items-center gap-1.5">
                  <dt className="text-zinc-500">{t("datumNs")}</dt>
                  <dd className="font-mono tabular-nums">{board.ns_datum}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt className="text-zinc-500">{t("datumEw")}</dt>
                  <dd className="font-mono tabular-nums">{board.ew_datum}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-zinc-500">{t("datumMissing")}</p>
            )}
          </div>
          {(results ?? []).length === 0 ? (
            <p className="text-sm text-zinc-600">{t("noResults")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">
                      {t("room")}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">
                      {t("contract")}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">
                      {t("lead")}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                      {t("scoreNs")}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                      {t("nsImps")}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                      {t("ewImps")}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">
                      {t("ns")}
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">
                      {t("ew")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(results ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-3 py-2">
                        {r.room === "closed"
                          ? t("roomClosed")
                          : r.room === "open"
                            ? t("roomOpen")
                            : r.room}
                      </td>
                      <td className="px-3 py-2">
                        <ContractLabel
                          contractLevel={r.contract_level}
                          contractDenomination={r.contract_denomination}
                          doubling={r.doubling}
                          declarer={r.declarer}
                          tricksResult={r.tricks_result}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <LeadLabel leadCard={r.lead_card as string | null} />
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
                        {r.ns_combination_id ? (
                          <Link
                            href={`/butler/rounds/${board.tournament_round}/pairs/${r.ns_combination_id}`}
                            className="link-inline"
                          >
                            {comboNames.get(r.ns_combination_id) ?? "—"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.ew_combination_id ? (
                          <Link
                            href={`/butler/rounds/${board.tournament_round}/pairs/${r.ew_combination_id}`}
                            className="link-inline"
                          >
                            {comboNames.get(r.ew_combination_id) ?? "—"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
