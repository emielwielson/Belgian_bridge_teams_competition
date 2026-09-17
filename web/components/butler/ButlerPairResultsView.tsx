import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatContract, formatImps } from "@/lib/butler/format";
import { createPublicClient } from "@/lib/supabase/server-client";

export async function ButlerPairResultsView({
  combinationId,
  tournamentRound,
}: {
  combinationId: string;
  tournamentRound: number | null;
}) {
  const t = await getTranslations("butler");
  const client = createPublicClient();

  const { data: combo } = await client
    .from("honor_player_combinations")
    .select("id, display_name, team_id, teams(name)")
    .eq("id", combinationId)
    .maybeSingle();
  if (!combo) notFound();

  const team = combo.teams as { name: string } | { name: string }[] | null;
  const teamName = Array.isArray(team)
    ? (team[0]?.name ?? "")
    : (team?.name ?? "");

  let query = client
    .from("honor_board_results")
    .select(
      "id, tournament_round, room, board_id, ns_combination_id, ew_combination_id, ns_butler_imps, ew_butler_imps, ns_score, contract_level, contract_denomination, doubling, declarer, tricks_result, honor_boards(board_number)",
    )
    .eq("processing_status", "published")
    .or(
      `ns_combination_id.eq.${combinationId},ew_combination_id.eq.${combinationId}`,
    )
    .order("tournament_round")
    .order("room");

  if (tournamentRound != null) {
    query = query.eq("tournament_round", tournamentRound);
  }

  const { data: results } = await query;

  const rows = (results ?? [])
    .map((r) => {
      const isNs = r.ns_combination_id === combinationId;
      const board = r.honor_boards as
        | { board_number: number }
        | { board_number: number }[]
        | null;
      const boardNumber = Array.isArray(board)
        ? board[0]?.board_number
        : board?.board_number;
      return {
        id: r.id,
        round: r.tournament_round as number,
        boardId: r.board_id as string,
        boardNumber: boardNumber ?? 0,
        direction: isNs ? "NS" : "EW",
        imps: Number(isNs ? r.ns_butler_imps : r.ew_butler_imps),
        contract: formatContract({
          contractLevel: r.contract_level as number | null,
          contractDenomination: r.contract_denomination as string | null,
          doubling: (r.doubling as string) ?? "NONE",
          declarer: r.declarer as string | null,
          tricksResult: r.tricks_result as string | null,
        }),
        opponentId: (isNs ? r.ew_combination_id : r.ns_combination_id) as
          | string
          | null,
      };
    })
    .sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.boardNumber - b.boardNumber;
    });

  const oppIds = [
    ...new Set(rows.map((r) => r.opponentId).filter(Boolean)),
  ] as string[];
  const { data: opps } = oppIds.length
    ? await client
        .from("honor_player_combinations")
        .select("id, display_name")
        .in("id", oppIds)
    : { data: [] };
  const oppNames = new Map(
    (opps ?? []).map((o) => [o.id as string, o.display_name as string]),
  );

  return (
    <main className="page-container max-w-5xl">
      <p className="text-sm">
        <Link
          href={
            tournamentRound != null
              ? `/butler/rounds/${tournamentRound}`
              : "/butler"
          }
          className="text-zinc-600 hover:underline"
        >
          {tournamentRound != null ? t("backRound") : t("backOverview")}
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{combo.display_name}</h1>
      <p className="mt-1 text-sm text-zinc-600">{teamName}</p>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">{t("pairDetail")}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600">{t("noResults")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  {tournamentRound == null ? (
                    <th className="px-3 py-2 font-medium">R</th>
                  ) : null}
                  <th className="px-3 py-2 font-medium">Board</th>
                  <th className="px-3 py-2 font-medium">{t("direction")}</th>
                  <th className="px-3 py-2 font-medium">{t("contract")}</th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("imps")}
                  </th>
                  <th className="px-3 py-2 font-medium">{t("opponent")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    {tournamentRound == null ? (
                      <td className="px-3 py-2 tabular-nums">{r.round}</td>
                    ) : null}
                    <td className="px-3 py-2">
                      <Link
                        href={`/butler/boards/${r.boardId}`}
                        className="link-inline"
                      >
                        {r.boardNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.direction}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.contract}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatImps(r.imps)}
                    </td>
                    <td className="px-3 py-2">
                      {r.opponentId ? (
                        <Link
                          href={
                            tournamentRound != null
                              ? `/butler/rounds/${tournamentRound}/pairs/${r.opponentId}`
                              : `/butler/pairs/${r.opponentId}`
                          }
                          className="link-inline"
                        >
                          {oppNames.get(r.opponentId) ?? "—"}
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
    </main>
  );
}
