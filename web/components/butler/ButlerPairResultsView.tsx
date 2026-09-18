import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ButlerPairResultsTable,
  type PairBoardHands,
  type PairResultRow,
} from "@/components/butler/ButlerPairResultsTable";
import type { BoardHands, Dealer, Vulnerability } from "@/lib/boards/types";
import { formatPairDisplayName } from "@/lib/butler/person-name";
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
      "id, tournament_round, room, board_id, ns_combination_id, ew_combination_id, ns_butler_imps, ew_butler_imps, ns_score, contract_level, contract_denomination, doubling, declarer, tricks_result, lead_card, honor_boards(board_number)",
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

  const rawRows = (results ?? [])
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
        contractLevel: r.contract_level as number | null,
        contractDenomination: r.contract_denomination as string | null,
        doubling: (r.doubling as string) ?? "NONE",
        declarer: r.declarer as string | null,
        tricksResult: r.tricks_result as string | null,
        leadCard: (r.lead_card as string | null) ?? null,
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
    ...new Set(rawRows.map((r) => r.opponentId).filter(Boolean)),
  ] as string[];
  const boardIds = [...new Set(rawRows.map((r) => r.boardId))];

  const [{ data: opps }, { data: boards }] = await Promise.all([
    oppIds.length
      ? client
          .from("honor_player_combinations")
          .select("id, display_name")
          .in("id", oppIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    boardIds.length
      ? client
          .from("honor_boards")
          .select("id, board_number, dealer, vulnerability, hands")
          .in("id", boardIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            board_number: number;
            dealer: string | null;
            vulnerability: string | null;
            hands: BoardHands | null;
          }[],
        }),
  ]);

  const oppNames = new Map(
    (opps ?? []).map((o) => [
      o.id as string,
      formatPairDisplayName(o.display_name as string),
    ]),
  );

  const boardsById: Record<string, PairBoardHands> = {};
  for (const b of boards ?? []) {
    boardsById[b.id as string] = {
      boardNumber: b.board_number as number,
      dealer: (b.dealer as Dealer | null) ?? null,
      vulnerability: (b.vulnerability as Vulnerability | null) ?? null,
      hands: (b.hands as BoardHands | null) ?? null,
    };
  }

  const rows: PairResultRow[] = rawRows.map((r) => ({
    ...r,
    opponentName: r.opponentId
      ? (oppNames.get(r.opponentId) ?? null)
      : null,
  }));

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
          {tournamentRound != null
            ? t("backRound", { round: tournamentRound })
            : t("backOverview")}
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        {formatPairDisplayName(combo.display_name)}
      </h1>
      <p className="mt-1 text-sm text-zinc-600">{teamName}</p>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">{t("pairDetail")}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600">{t("noResults")}</p>
        ) : (
          <ButlerPairResultsTable
            rows={rows}
            boardsById={boardsById}
            tournamentRound={tournamentRound}
          />
        )}
      </section>
    </main>
  );
}
