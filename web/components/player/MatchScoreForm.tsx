"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { toIntlLocale } from "@/i18n/intl-locale";
import { formatBrussels } from "@/lib/time/brussels";

type Props = {
  matchId: string;
  boardCount: number;
  initialImpsHome: number | null;
  initialImpsAway: number | null;
  initialVpHome: number | null;
  initialVpAway: number | null;
  playedAt: string | null;
  isAdmin: boolean;
  canEditFinishedScore?: boolean;
  lineupsComplete: boolean;
  /** When false, show read-only score info (no submit form). */
  allowSubmit?: boolean;
};

export function MatchScoreForm({
  matchId,
  boardCount,
  initialImpsHome,
  initialImpsAway,
  initialVpHome,
  initialVpAway,
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
  const [saving, setSaving] = useState(false);
  const [vpHome, setVpHome] = useState<number | null>(initialVpHome);
  const [vpAway, setVpAway] = useState<number | null>(initialVpAway);
  const [playedAt, setPlayedAt] = useState<string | null>(initialPlayedAt);
  const [error, setError] = useState<string | null>(null);

  const locked = playedAt != null;
  const canSubmit = allowSubmit && !locked && lineupsComplete;
  const canEditLockedScore = locked && canEditFinishedScore;

  if (!allowSubmit && !locked && !canEditFinishedScore) {
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
      const res = await fetch(`/api/matches/${matchId}/score`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imps_home: Number(impsHome),
          imps_away: Number(impsAway),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("submitFailed"));
      setVpHome(body.match.vp_home);
      setVpAway(body.match.vp_away);
      setPlayedAt(body.match.played_at ?? new Date().toISOString());
      if (body.match.imps_home != null) setImpsHome(String(body.match.imps_home));
      if (body.match.imps_away != null) setImpsAway(String(body.match.imps_away));
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
        {playedAt ? (
          <p className="mt-2 text-xs text-zinc-500">
            {t("playedAt", { datetime: formatBrussels(playedAt, intlLocale) })}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-500">{t("lockedContact")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">
        {canEditLockedScore ? t("editTitle") : t("submitTitle")}
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        {t("boardsVpFromTable", { boardCount })}
      </p>
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
          disabled={saving || impsHome === "" || impsAway === ""}
          className="mt-4 w-full rounded-md bg-emerald-700 px-3 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? t("submitting") : t("submitOfficial")}
        </button>
      ) : null}
      {canEditLockedScore ? (
        <button
          type="button"
          onClick={() => submit("PATCH")}
          disabled={saving || impsHome === "" || impsAway === ""}
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
