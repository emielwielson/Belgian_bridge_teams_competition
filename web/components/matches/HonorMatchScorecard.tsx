import { getLocale, getTranslations } from "next-intl/server";
import { ContractLabel } from "@/components/butler/ContractLabel";
import type {
  HonorMatchScorecard,
  ScorecardContract,
  ScorecardRoomCell,
} from "@/lib/competition/honor-match-scorecard";
import type { Dealer, Vulnerability } from "@/lib/boards/types";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { Locale } from "@/i18n/config";

type Props = {
  scorecard: HonorMatchScorecard;
};

/** Thick vertical divider between board | open | closed | result. */
const SECTION = "border-l-[3px] border-l-zinc-500";
/** Thin divider within a section. */
const INNER = "border-l border-l-zinc-200";
const ROW_BOTTOM = "border-b border-b-zinc-100";
const HEAD_BOTTOM = "border-b border-b-zinc-300";

function ContractCell({ contract }: { contract: ScorecardContract | null }) {
  if (!contract) return <span className="text-zinc-300">—</span>;
  return (
    <ContractLabel
      contractLevel={contract.contractLevel}
      contractDenomination={contract.contractDenomination}
      doubling={contract.doubling}
      declarer={contract.declarer}
      tricksResult={contract.tricksResult}
    />
  );
}

function ScoreCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-zinc-300">—</span>;
  return <span className="tabular-nums">{value}</span>;
}

function ImpCell({ value }: { value: number }) {
  if (value === 0) return <span className="text-zinc-300">—</span>;
  return <span className="tabular-nums font-medium">{value}</span>;
}

export async function HonorMatchScorecardView({ scorecard }: Props) {
  const t = await getTranslations("match.scorecard");
  const locale = (await getLocale()) as Locale;
  const intlLocale = toIntlLocale(locale);
  const vpFmt = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const dealerLabel = (d: Dealer | null) => {
    if (!d) return "—";
    return t(`dealer.${d}`);
  };
  const vulLabel = (v: Vulnerability | null) => {
    if (!v) return "—";
    return t(`vulnerability.${v}`);
  };

  const openTable = scorecard.venueTables?.openTable;
  const closedTable = scorecard.venueTables?.closedTable;

  const roomTitle = (
    room: "open" | "closed",
    table: number | undefined,
  ) => {
    if (table != null) {
      return t(room === "open" ? "openRoomWithTable" : "closedRoomWithTable", {
        table,
      });
    }
    return t(room === "open" ? "openRoom" : "closedRoom");
  };

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-zinc-100 text-xs text-zinc-700">
              <th colSpan={3} className={`${HEAD_BOTTOM} px-2 py-2`} />
              <th
                colSpan={3}
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-2 text-left font-semibold align-top`}
              >
                <div className="space-y-0.5">
                  <p>{roomTitle("open", openTable)}</p>
                  <p className="font-normal text-zinc-600">
                    <span className="font-medium text-zinc-800">{t("ns")}:</span>{" "}
                    {scorecard.openPairs.ns}
                  </p>
                  <p className="font-normal text-zinc-600">
                    <span className="font-medium text-zinc-800">{t("ew")}:</span>{" "}
                    {scorecard.openPairs.ew}
                  </p>
                </div>
              </th>
              <th
                colSpan={3}
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-2 text-left font-semibold align-top`}
              >
                <div className="space-y-0.5">
                  <p>{roomTitle("closed", closedTable)}</p>
                  <p className="font-normal text-zinc-600">
                    <span className="font-medium text-zinc-800">{t("ns")}:</span>{" "}
                    {scorecard.closedPairs.ns}
                  </p>
                  <p className="font-normal text-zinc-600">
                    <span className="font-medium text-zinc-800">{t("ew")}:</span>{" "}
                    {scorecard.closedPairs.ew}
                  </p>
                </div>
              </th>
              <th
                colSpan={3}
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-2 text-center font-semibold align-bottom`}
              >
                {t("result")}
              </th>
            </tr>
            <tr className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className={`${HEAD_BOTTOM} px-2 py-1.5 text-left font-medium`}>
                {t("board")}
              </th>
              <th
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-1.5 text-left font-medium`}
              >
                {t("dealerCol")}
              </th>
              <th
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-1.5 text-left font-medium`}
              >
                {t("vulCol")}
              </th>
              <th
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-1.5 text-left font-medium`}
              >
                {t("homeNs")}
              </th>
              <th
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-1.5 text-left font-medium`}
              >
                {t("awayEw")}
              </th>
              <th
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-1.5 text-right font-medium`}
              >
                {t("scoreHome")}
              </th>
              <th
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-1.5 text-left font-medium`}
              >
                {t("homeEw")}
              </th>
              <th
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-1.5 text-left font-medium`}
              >
                {t("awayNs")}
              </th>
              <th
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-1.5 text-right font-medium`}
              >
                {t("scoreHome")}
              </th>
              <th
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-1.5 text-right font-medium`}
              >
                {t("deltaMp")}
              </th>
              <th
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-1.5 text-right font-medium`}
              >
                {t("impsHome")}
              </th>
              <th
                className={`${INNER} ${HEAD_BOTTOM} px-2 py-1.5 text-right font-medium`}
              >
                {t("impsAway")}
              </th>
            </tr>
          </thead>
          <tbody>
            {scorecard.boards.map((board, i) => {
              const stripe = i % 2 === 0 ? "bg-white" : "bg-zinc-50/80";
              return (
                <tr key={board.boardId}>
                  <td
                    className={`${ROW_BOTTOM} px-2 py-1.5 tabular-nums font-medium text-zinc-900 ${stripe}`}
                  >
                    {board.boardNumber}
                  </td>
                  <td
                    className={`${INNER} ${ROW_BOTTOM} px-2 py-1.5 text-zinc-700 ${stripe}`}
                  >
                    {dealerLabel(board.dealer)}
                  </td>
                  <td
                    className={`${INNER} ${ROW_BOTTOM} px-2 py-1.5 text-zinc-700 ${stripe}`}
                  >
                    {vulLabel(board.vulnerability)}
                  </td>
                  <RoomCells cell={board.open} sectionBorder stripe={stripe} />
                  <RoomCells
                    cell={board.closed}
                    sectionBorder
                    stripe={stripe}
                  />
                  <td
                    className={`${SECTION} ${ROW_BOTTOM} px-2 py-1.5 text-right tabular-nums text-zinc-800 ${stripe}`}
                  >
                    {board.deltaMp == null ? (
                      <span className="text-zinc-300">—</span>
                    ) : (
                      board.deltaMp
                    )}
                  </td>
                  <td
                    className={`${INNER} ${ROW_BOTTOM} px-2 py-1.5 text-right text-zinc-900 ${stripe}`}
                  >
                    <ImpCell value={board.impsHome} />
                  </td>
                  <td
                    className={`${INNER} ${ROW_BOTTOM} px-2 py-1.5 text-right text-zinc-900 ${stripe}`}
                  >
                    <ImpCell value={board.impsAway} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-100">
              <td
                colSpan={10}
                className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600"
              >
                {t("totalImps")}
              </td>
              <td
                className={`${INNER} px-2 py-2 text-right tabular-nums font-semibold text-zinc-900`}
              >
                {scorecard.totals.impsHome}
              </td>
              <td
                className={`${INNER} px-2 py-2 text-right tabular-nums font-semibold text-zinc-900`}
              >
                {scorecard.totals.impsAway}
              </td>
            </tr>
            {scorecard.totals.vpHome != null &&
            scorecard.totals.vpAway != null ? (
              <tr className="bg-zinc-100">
                <td
                  colSpan={10}
                  className="px-2 pb-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600"
                >
                  {t("resultVp")}
                </td>
                <td
                  className={`${INNER} px-2 pb-2.5 text-right tabular-nums font-semibold text-zinc-900`}
                >
                  {vpFmt.format(scorecard.totals.vpHome)}
                </td>
                <td
                  className={`${INNER} px-2 pb-2.5 text-right tabular-nums font-semibold text-zinc-900`}
                >
                  {vpFmt.format(scorecard.totals.vpAway)}
                </td>
              </tr>
            ) : null}
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function RoomCells({
  cell,
  sectionBorder,
  stripe,
}: {
  cell: ScorecardRoomCell;
  sectionBorder?: boolean;
  stripe: string;
}) {
  return (
    <>
      <td
        className={`${sectionBorder ? SECTION : ""} ${ROW_BOTTOM} px-2 py-1.5 ${stripe}`}
      >
        <ContractCell contract={cell.homeContract} />
      </td>
      <td className={`${INNER} ${ROW_BOTTOM} px-2 py-1.5 ${stripe}`}>
        <ContractCell contract={cell.awayContract} />
      </td>
      <td
        className={`${INNER} ${ROW_BOTTOM} px-2 py-1.5 text-right text-zinc-800 ${stripe}`}
      >
        <ScoreCell value={cell.scoreHome} />
      </td>
    </>
  );
}
