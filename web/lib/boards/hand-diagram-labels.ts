import type { Dealer, Vulnerability } from "@/lib/boards/types";
import type { HandDiagramLabels } from "@/components/boards/HandDiagram";

type ButlerTranslate = {
  (key: string, values?: Record<string, string | number | Date>): string;
};

/**
 * Build HandDiagram labels from butler message keys.
 * Expects keys: dealPlateAria, seatN/E/S/W, dealTitle (for boardLabel).
 */
export function handDiagramLabelsFromButler(
  t: ButlerTranslate,
  opts: {
    dealer: Dealer | string | null | undefined;
    vulnerability: Vulnerability | string | null | undefined;
    boardNumber?: number;
  },
): HandDiagramLabels {
  const dealerKey =
    opts.dealer === "N" ||
    opts.dealer === "E" ||
    opts.dealer === "S" ||
    opts.dealer === "W"
      ? opts.dealer
      : "N";
  const vulnKey =
    opts.vulnerability === "NONE" ||
    opts.vulnerability === "NS" ||
    opts.vulnerability === "EW" ||
    opts.vulnerability === "BOTH"
      ? opts.vulnerability
      : "NONE";

  return {
    dealPlateAria: t("dealPlateAria", {
      dealer: t(`seatFull.${dealerKey}`),
      vulnerability: t(`vulnerability.${vulnKey}`),
    }),
    seatLetters: {
      N: t("seatLetter.N"),
      E: t("seatLetter.E"),
      S: t("seatLetter.S"),
      W: t("seatLetter.W"),
    },
    boardLabel:
      opts.boardNumber != null
        ? t("dealTitle", { board: opts.boardNumber })
        : undefined,
  };
}
