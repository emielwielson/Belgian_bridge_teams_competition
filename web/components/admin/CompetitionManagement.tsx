"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  collapseRoundsToRegionalMatchDays,
  REGIONAL_MATCH_DAY_COUNT,
  REGIONAL_SLOT_TIME,
} from "@/lib/competition/regional-match-schedule";
import type { CompetitionScope } from "@/lib/competition/scopes";

type Props = {
  scope: CompetitionScope;
  regionCode?: string;
  title?: string;
  readOnly?: boolean;
  onSaved?: () => void;
};

export function CompetitionManagement({
  scope,
  regionCode,
  title,
  readOnly = false,
  onSaved,
}: Props) {
  const t = useTranslations("admin.matchDates");

  const [matchDays, setMatchDays] = useState<string[]>(() =>
    Array.from({ length: REGIONAL_MATCH_DAY_COUNT }, () => ""),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setCount = matchDays.filter((d) => d.length > 0).length;
  const complete = setCount >= REGIONAL_MATCH_DAY_COUNT;

  const loadDates = useCallback(async () => {
    const params = new URLSearchParams({ scope });
    if (regionCode) params.set("region", regionCode);
    const res = await fetch(`/api/admin/competition/dates?${params}`);
    if (!res.ok) return;
    const body = await res.json();
    if (body.matchDays?.length) {
      setMatchDays(body.matchDays);
      return;
    }
    const loaded = (body.dates ?? []) as { round: number; datetime: string }[];
    if (loaded.length === 0) return;
    setMatchDays(collapseRoundsToRegionalMatchDays(loaded));
  }, [scope, regionCode]);

  useEffect(() => {
    void loadDates();
  }, [loadDates]);

  async function saveDates() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/competition/dates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        region: regionCode,
        matchDays,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error ?? t("saveFailed"));
      return;
    }
    setMessage(t("saved"));
    await loadDates();
    onSaved?.();
  }

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">
          {title ?? t("title", { roundCount: REGIONAL_MATCH_DAY_COUNT })}
        </h2>
        <span
          className={`text-sm font-medium ${complete ? "text-green-700" : "text-zinc-500"}`}
        >
          {t("daysProgress", {
            set: setCount,
            required: REGIONAL_MATCH_DAY_COUNT,
          })}
        </span>
      </div>
      <p className="text-sm text-zinc-600">
        {t("pickDatesOnly", { slotTime: REGIONAL_SLOT_TIME })}
      </p>
      <ul className="flex flex-col gap-2">
        {matchDays.map((day, index) => (
          <li key={index} className="flex items-center gap-3">
            <span className="w-16 text-sm font-medium text-zinc-700">
              {t("round", { round: index + 1 })}
            </span>
            <input
              type="date"
              value={day}
              disabled={readOnly}
              onChange={(e) =>
                setMatchDays((prev) =>
                  prev.map((d, i) => (i === index ? e.target.value : d)),
                )
              }
              className="input flex-1"
            />
          </li>
        ))}
      </ul>
      {!readOnly && (
        <button
          type="button"
          disabled={loading}
          onClick={saveDates}
          className="btn-primary w-fit"
        >
          {loading ? t("saving") : t("saveDates")}
        </button>
      )}
      {message && (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
