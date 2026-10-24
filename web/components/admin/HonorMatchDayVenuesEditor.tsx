"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { HonorMatchDayVenue } from "@/lib/competition/honor-match-day-venues";

type Props = {
  onSaved?: () => void;
};

const EMPTY_VENUES = Array.from({ length: 7 }, () => "");

export function HonorMatchDayVenuesEditor({ onSaved }: Props) {
  const t = useTranslations("admin.honorVenues");
  const tCommon = useTranslations("common");

  const [venues, setVenues] = useState<string[]>(() => [...EMPTY_VENUES]);
  const [matchDays, setMatchDays] = useState<string[]>(() =>
    Array.from({ length: 7 }, () => ""),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setCount = venues.filter((v) => v.trim().length > 0).length;
  const complete = setCount >= 7;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/competition/honor-venues");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t("loadFailed"));
      }
      const body = await res.json();
      const loaded = (body.venues ?? []) as HonorMatchDayVenue[];
      setVenues(
        Array.from({ length: 7 }, (_, i) => loaded[i]?.location ?? ""),
      );
      setMatchDays(
        Array.isArray(body.matchDays) && body.matchDays.length === 7
          ? body.matchDays
          : Array.from({ length: 7 }, () => ""),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveVenues() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/competition/honor-venues", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venues }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("saveFailed"));
      const loaded = (body.venues ?? []) as HonorMatchDayVenue[];
      setVenues(
        Array.from({ length: 7 }, (_, i) => loaded[i]?.location ?? ""),
      );
      setMessage(t("saved"));
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">{t("title")}</h3>
          <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
        </div>
        <span
          className={`shrink-0 text-sm font-medium ${complete ? "text-green-700" : "text-zinc-500"}`}
        >
          {t("venuesProgress", { set: setCount, required: 7 })}
        </span>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">{tCommon("loading")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {venues.map((venue, index) => (
            <li key={index} className="flex flex-wrap items-center gap-3">
              <span className="w-28 shrink-0 text-sm font-medium text-zinc-700">
                {t("matchDay", { index: index + 1 })}
              </span>
              {matchDays[index] ? (
                <span className="w-28 shrink-0 text-xs text-zinc-500">
                  {matchDays[index]}
                </span>
              ) : (
                <span className="w-28 shrink-0 text-xs text-zinc-400">
                  {t("dateUnset")}
                </span>
              )}
              <input
                type="text"
                className="input min-w-0 flex-1 text-sm"
                value={venue}
                placeholder={t("placeholder")}
                disabled={saving}
                onChange={(e) => {
                  const next = [...venues];
                  next[index] = e.target.value;
                  setVenues(next);
                  setMessage(null);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={loading || saving}
          onClick={() => void saveVenues()}
        >
          {saving ? tCommon("saving") : t("saveVenues")}
        </button>
        <p className="text-xs text-zinc-500">{t("optionalHint")}</p>
      </div>
    </div>
  );
}
