"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import { toIntlLocale } from "@/i18n/intl-locale";
import { formatBrussels } from "@/lib/time/brussels";
import {
  BOARD_CHOICE_OPTIONS,
  type BoardChoice,
  vpBoardCount,
} from "@/lib/scoring/board-count-rules";

type Props = {
  matchId: string;
  scheduledBoardCount: number;
  allowsBoardChoice: boolean;
  initialImpsHome: number | null;
  initialImpsAway: number | null;
  initialVpHome: number | null;
  initialVpAway: number | null;
  initialMisSeating?: boolean;
  initialSelectedBoardCount?: number | null;
  initialVpBoardCount?: number | null;
  playedAt: string | null;
  isAdmin: boolean;
  canEditFinishedScore?: boolean;
  lineupsComplete: boolean;
  /** When false, show read-only score info (no submit form). */
  allowSubmit?: boolean;
};

export function MatchScoreForm({
  matchId,
  scheduledBoardCount,
  allowsBoardChoice,
  initialImpsHome,
  initialImpsAway,
  initialVpHome,
  initialVpAway,
  initialMisSeating = false,
  initialSelectedBoardCount = null,
  initialVpBoardCount = null,
  playedAt: initialPlayedAt,
  isAdmin,
  canEditFinishedScore = isAdmin,
  lineupsComplete,
  allowSubmit = true,
}: Props) {
  const t = useTranslations("match.score");
  const locale = useLocale() as Locale;
  const intlLocale = toIntlLocale(locale);
  const [impsHome, setImpsHome] = useState(
    initialImpsHome != null ? String(initialImpsHome) : "",
  );
  const [impsAway, setImpsAway] = useState(
    initialImpsAway != null ? String(initialImpsAway) : "",
  );
  const [selectedBoardCount, setSelectedBoardCount] = useState<BoardChoice | null>(
    initialSelectedBoardCount === 28 || initialSelectedBoardCount === 32
      ? initialSelectedBoardCount
      : null,
  );
  const [misSeating, setMisSeating] = useState(initialMisSeating);
  const [saving, setSaving] = useState(false);
  const [vpHome, setVpHome] = useState<number | null>(initialVpHome);
  const [vpAway, setVpAway] = useState<number | null>(initialVpAway);
  const [vpBoardCountDisplay, setVpBoardCountDisplay] = useState<number | null>(
    initialVpBoardCount,
  );
  const [playedAt, setPlayedAt] = useState<string | null>(initialPlayedAt);
  const [error, setError] = useState<string | null>(null);

  const locked = playedAt != null;
  const canSubmit = allowSubmit && !locked && lineupsComplete;
  const canEditLockedScore = locked && canEditFinishedScore;

  const nominalBoardCount = allowsBoardChoice
    ? selectedBoardCount
    : scheduledBoardCount;

  const effectiveVpBoardCount = useMemo(() => {
    if (locked && vpBoardCountDisplay != null) return vpBoardCountDisplay;
    if (nominalBoardCount == null) return null;
    return vpBoardCount(nominalBoardCount, misSeating);
  }, [locked, vpBoardCountDisplay, nominalBoardCount, misSeating]);

  const boardChoiceMissing = allowsBoardChoice && selectedBoardCount == null;

  if (!allowSubmit && !locked && !canEditLockedScore) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h3 className="text-sm font-semibold text-zinc-900">{t("title")}</h3>
        <p className="mt-2 text-sm text-zinc-600">{t("notPlayedYet")}</p>
      </section>
    );
  }

  if (!locked && !lineupsComplete) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h3 className="text-sm font-semibold text-zinc-900">{t("submitTitle")}</h3>
        <p className="mt-2 text-sm text-amber-800">{t("lineupsFirst")}</p>
      </section>
    );
  }

  async function submit(method: "POST" | "PATCH") {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        imps_home: Number(impsHome),
        imps_away: Number(impsAway),
        mis_seating: misSeating,
      };
      if (allowsBoardChoice && selectedBoardCount != null) {
        body.selected_board_count = selectedBoardCount;
      }

      const res = await fetch(`/api/matches/${matchId}/score`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await res.json();
      if (!res.ok) throw new Error(responseBody.error ?? t("submitFailed"));
      setVpHome(responseBody.match.vp_home);
      setVpAway(responseBody.match.vp_away);
      setVpBoardCountDisplay(responseBody.match.vp_board_count ?? null);
      setPlayedAt(responseBody.match.played_at ?? new Date().toISOString());
      if (responseBody.match.imps_home != null) {
        setImpsHome(String(responseBody.match.imps_home));
      }
      if (responseBody.match.imps_away != null) {
        setImpsAway(String(responseBody.match.imps_away));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("submitFailedGeneric"));
    } finally {
      setSaving(false);
    }
  }

  if (locked && !canEditLockedScore) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h3 className="text-sm font-semibold text-zinc-900">{t("officialTitle")}</h3>
        <p className="mt-2 text-sm text-zinc-700">
          {t("imps", { home: impsHome, away: impsAway })}
        </p>
        {vpHome != null && vpAway != null ? (
          <p className="mt-1 text-sm text-zinc-700">
            {t("vp", { home: vpHome, away: vpAway })}
          </p>
        ) : null}
        {effectiveVpBoardCount != null ? (
          <p className="mt-1 text-xs text-zinc-500">
            {initialMisSeating
              ? t("vpScaleMisSeating", {
                  scheduled: scheduledBoardCount,
                  effective: effectiveVpBoardCount,
                })
              : t("vpScaleBoards", { boardCount: effectiveVpBoardCount })}
          </p>
        ) : null}
        {playedAt ? (
          <p className="mt-2 text-xs text-zinc-500">
            {t("playedAt", { datetime: formatBrussels(playedAt, intlLocale) })}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-500">{t("lockedContact")}</p>
      </section>
    );
  }

  const submitDisabled =
    saving || impsHome === "" || impsAway === "" || boardChoiceMissing;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">
        {canEditLockedScore ? t("editTitle") : t("submitTitle")}
      </h3>
      {allowsBoardChoice ? (
        <fieldset className="mt-3">
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
                  name="boardCount"
                  value={count}
                  checked={selectedBoardCount === count}
                  disabled={saving}
                  onChange={() => setSelectedBoardCount(count)}
                />
                {t("boardsOption", { count })}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="mt-1 text-xs text-zinc-500">
          {t("scheduledBoards", { boardCount: scheduledBoardCount })}
        </p>
      )}
      <label className="mt-3 flex items-start gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={misSeating}
          disabled={saving}
          onChange={(e) => setMisSeating(e.target.checked)}
          className="mt-0.5"
        />
        <span>{t("misSeating")}</span>
      </label>
      {effectiveVpBoardCount != null ? (
        <p className="mt-2 text-xs text-zinc-500">
          {misSeating
            ? t("vpScaleMisSeating", {
                scheduled: nominalBoardCount ?? scheduledBoardCount,
                effective: effectiveVpBoardCount,
              })
            : t("vpScaleBoards", { boardCount: effectiveVpBoardCount })}
        </p>
      ) : boardChoiceMissing ? (
        <p className="mt-2 text-xs text-amber-700">{t("boardCountRequired")}</p>
      ) : null}
      {playedAt && canEditLockedScore ? (
        <p className="mt-1 text-xs text-zinc-500">
          {t("lastScored", { datetime: formatBrussels(playedAt, intlLocale) })}
        </p>
      ) : null}
      <ScoreImpsInputs
        impsHome={impsHome}
        impsAway={impsAway}
        setImpsHome={setImpsHome}
        setImpsAway={setImpsAway}
        disabled={saving}
        homeLabel={t("homeImps")}
        awayLabel={t("awayImps")}
      />
      {canSubmit ? (
        <button
          type="button"
          onClick={() => submit("POST")}
          disabled={submitDisabled}
          className="mt-4 w-full rounded-md bg-emerald-700 px-3 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? t("submitting") : t("submitOfficial")}
        </button>
      ) : null}
      {canEditLockedScore ? (
        <button
          type="button"
          onClick={() => submit("PATCH")}
          disabled={submitDisabled}
          className="mt-4 w-full rounded-md bg-amber-700 px-3 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? t("saving") : t("overwriteOfficial")}
        </button>
      ) : null}
      {vpHome != null && vpAway != null && locked ? (
        <p className="mt-2 text-sm text-emerald-700">
          {t("vp", { home: vpHome, away: vpAway })}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}

function ScoreImpsInputs({
  impsHome,
  impsAway,
  setImpsHome,
  setImpsAway,
  disabled,
  homeLabel,
  awayLabel,
}: {
  impsHome: string;
  impsAway: string;
  setImpsHome: (v: string) => void;
  setImpsAway: (v: string) => void;
  disabled: boolean;
  homeLabel: string;
  awayLabel: string;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <label className="block text-xs font-medium text-zinc-600">
        {homeLabel}
        <input
          type="number"
          inputMode="numeric"
          value={impsHome}
          disabled={disabled}
          onChange={(e) => setImpsHome(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600">
        {awayLabel}
        <input
          type="number"
          inputMode="numeric"
          value={impsAway}
          disabled={disabled}
          onChange={(e) => setImpsAway(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
        />
      </label>
    </div>
  );
}
