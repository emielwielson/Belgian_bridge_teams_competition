"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  BOARD_CHOICE_OPTIONS,
  type BoardChoice,
  vpBoardCount,
} from "@/lib/scoring/board-count-rules";

export type ScoreCorrectionValue = {
  impsHome: string;
  impsAway: string;
  misSeating: boolean;
  selectedBoardCount: BoardChoice | null;
};

type Props = {
  scheduledBoardCount: number;
  allowsBoardChoice: boolean;
  initialVpHome: number | null;
  initialVpAway: number | null;
  value: ScoreCorrectionValue;
  onChange: (value: ScoreCorrectionValue) => void;
  disabled?: boolean;
  idPrefix?: string;
};

export function ArbiterResolveScoreFields({
  scheduledBoardCount,
  allowsBoardChoice,
  initialVpHome,
  initialVpAway,
  value,
  onChange,
  disabled = false,
  idPrefix = "score",
}: Props) {
  const t = useTranslations("arbiter.score");

  const nominalBoardCount = allowsBoardChoice
    ? value.selectedBoardCount
    : scheduledBoardCount;

  const effectiveVpBoardCount = useMemo(() => {
    if (nominalBoardCount == null) return null;
    return vpBoardCount(nominalBoardCount, value.misSeating);
  }, [nominalBoardCount, value.misSeating]);

  const boardChoiceMissing = allowsBoardChoice && value.selectedBoardCount == null;

  return (
    <div className="space-y-3">
      {allowsBoardChoice ? (
        <fieldset>
          <legend className="text-xs font-medium text-zinc-600">
            {t("boardCountChoice")}
          </legend>
          <div className="mt-2 flex gap-4">
            {BOARD_CHOICE_OPTIONS.map((count) => (
              <label
                key={count}
                className="flex items-center gap-2 text-sm text-zinc-700"
              >
                <input
                  type="radio"
                  name={`${idPrefix}-boardCount`}
                  value={count}
                  checked={value.selectedBoardCount === count}
                  onChange={() =>
                    onChange({ ...value, selectedBoardCount: count })
                  }
                  disabled={disabled}
                />
                {t("boardsOption", { count })}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-600">
          {t("impsHome")}
          <input
            id={`${idPrefix}-imps-home`}
            type="number"
            step={1}
            value={value.impsHome}
            onChange={(e) => onChange({ ...value, impsHome: e.target.value })}
            disabled={disabled}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          {t("impsAway")}
          <input
            id={`${idPrefix}-imps-away`}
            type="number"
            step={1}
            value={value.impsAway}
            onChange={(e) => onChange({ ...value, impsAway: e.target.value })}
            disabled={disabled}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={value.misSeating}
          onChange={(e) =>
            onChange({ ...value, misSeating: e.target.checked })
          }
          disabled={disabled}
        />
        {t("misSeating")}
      </label>

      {effectiveVpBoardCount != null ? (
        <p className="text-xs text-zinc-500">
          {value.misSeating
            ? t("vpScaleMisSeating", {
                scheduled: nominalBoardCount ?? scheduledBoardCount,
                effective: effectiveVpBoardCount,
              })
            : t("vpScaleBoards", { boardCount: effectiveVpBoardCount })}
        </p>
      ) : null}

      {initialVpHome != null && initialVpAway != null ? (
        <p className="text-xs text-zinc-500">
          {t("currentVp", { home: initialVpHome, away: initialVpAway })}
        </p>
      ) : null}

      {boardChoiceMissing ? (
        <p className="text-xs text-amber-800">{t("boardCountRequired")}</p>
      ) : null}
    </div>
  );
}

export function emptyScoreCorrection(
  impsHome: number | null,
  impsAway: number | null,
  misSeating: boolean,
  selectedBoardCount: number | null,
): ScoreCorrectionValue {
  return {
    impsHome: impsHome != null ? String(impsHome) : "",
    impsAway: impsAway != null ? String(impsAway) : "",
    misSeating,
    selectedBoardCount:
      selectedBoardCount === 28 || selectedBoardCount === 32
        ? selectedBoardCount
        : null,
  };
}

export function isScoreCorrectionComplete(
  value: ScoreCorrectionValue,
  allowsBoardChoice: boolean,
): boolean {
  if (value.impsHome === "" || value.impsAway === "") return false;
  if (!Number.isFinite(Number(value.impsHome))) return false;
  if (!Number.isFinite(Number(value.impsAway))) return false;
  if (allowsBoardChoice && value.selectedBoardCount == null) return false;
  return true;
}

export function scoreCorrectionToPayload(
  value: ScoreCorrectionValue,
  allowsBoardChoice: boolean,
) {
  const payload: Record<string, unknown> = {
    imps_home: Number(value.impsHome),
    imps_away: Number(value.impsAway),
    mis_seating: value.misSeating,
  };
  if (allowsBoardChoice && value.selectedBoardCount != null) {
    payload.selected_board_count = value.selectedBoardCount;
  }
  return payload;
}
