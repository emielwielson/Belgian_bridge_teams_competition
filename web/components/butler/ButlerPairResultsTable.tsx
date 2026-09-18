"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { HandDiagram } from "@/components/boards/HandDiagram";
import { ContractLabel } from "@/components/butler/ContractLabel";
import { LeadLabel } from "@/components/butler/LeadLabel";
import type { BoardHands, Dealer, Vulnerability } from "@/lib/boards/types";
import { handDiagramLabelsFromButler } from "@/lib/boards/hand-diagram-labels";
import { formatImps } from "@/lib/butler/format";

export type PairResultRow = {
  id: string;
  round: number;
  boardId: string;
  boardNumber: number;
  direction: string;
  imps: number;
  contractLevel: number | null;
  contractDenomination: string | null;
  doubling: string;
  declarer: string | null;
  tricksResult: string | null;
  leadCard: string | null;
  opponentId: string | null;
  opponentName: string | null;
};

export type PairBoardHands = {
  boardNumber: number;
  dealer: Dealer | null;
  vulnerability: Vulnerability | null;
  hands: BoardHands | null;
};

export function ButlerPairResultsTable({
  rows,
  boardsById,
  tournamentRound,
}: {
  rows: PairResultRow[];
  boardsById: Record<string, PairBoardHands>;
  tournamentRound: number | null;
}) {
  const t = useTranslations("butler");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const colCount = tournamentRound == null ? 7 : 6;

  function toggleExpand(rowId: string) {
    setExpandedRowId((current) => (current === rowId ? null : rowId));
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-500">
          <tr>
            {tournamentRound == null ? (
              <th className="whitespace-nowrap px-3 py-2 font-medium">R</th>
            ) : null}
            <th className="whitespace-nowrap px-3 py-2 font-medium">
              {t("boards")}
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">
              {t("direction")}
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">
              {t("contract")}
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">
              {t("lead")}
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
              {t("imps")}
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">
              {t("opponent")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => {
            const expanded = expandedRowId === r.id;
            const board = boardsById[r.boardId];
            return (
              <Fragment key={r.id}>
                <tr>
                  {tournamentRound == null ? (
                    <td className="px-3 py-2 tabular-nums">{r.round}</td>
                  ) : null}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="link-inline"
                      aria-expanded={expanded}
                      aria-controls={`pair-board-${r.id}`}
                      onClick={() => toggleExpand(r.id)}
                    >
                      {r.boardNumber}
                    </button>
                  </td>
                  <td className="px-3 py-2">{r.direction}</td>
                  <td className="px-3 py-2">
                    <ContractLabel
                      contractLevel={r.contractLevel}
                      contractDenomination={r.contractDenomination}
                      doubling={r.doubling}
                      declarer={r.declarer}
                      tricksResult={r.tricksResult}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <LeadLabel leadCard={r.leadCard} />
                  </td>
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
                        {r.opponentName ?? "—"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                {expanded ? (
                  <tr id={`pair-board-${r.id}`}>
                    <td
                      colSpan={colCount}
                      className="bg-zinc-50/80 px-3 py-4"
                    >
                      <div className="mx-auto max-w-md">
                        {board?.hands ? (
                          <HandDiagram
                            boardNumber={board.boardNumber}
                            dealer={board.dealer}
                            vulnerability={board.vulnerability}
                            hands={board.hands}
                            labels={handDiagramLabelsFromButler(t, {
                              dealer: board.dealer,
                              vulnerability: board.vulnerability,
                              boardNumber: board.boardNumber,
                            })}
                            showBoardNumber={false}
                          />
                        ) : (
                          <p className="text-sm text-zinc-500">
                            {t("noBoards")}
                          </p>
                        )}
                        <p className="mt-3 text-sm">
                          <Link
                            href={`/butler/boards/${r.boardId}`}
                            className="link-inline"
                          >
                            {t("openBoard", { board: r.boardNumber })}
                          </Link>
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
