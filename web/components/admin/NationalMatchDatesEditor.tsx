"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  collapseRoundsToMatchDays,
  formatSlotTimesLabel,
  NATIONAL_MATCH_DAY_COUNTS,
} from "@/lib/competition/national-match-schedule";
import type { NationalScheduleKey } from "@/lib/competition/national-structure";
import type { CompetitionScope } from "@/lib/competition/scopes";

type Props = {
  scope: CompetitionScope;
  scheduleKey: NationalScheduleKey;
  title?: string;
  readOnly?: boolean;
  onSaved?: () => void;
};

export function NationalMatchDatesEditor({
  scope,
  scheduleKey,
  title,
  readOnly = false,
  onSaved,
}: Props) {
  const t = useTranslations("admin.nationalMatchDays");
  const tDates = useTranslations("admin.matchDates");
  const tCommon = useTranslations("common");

  const matchDayCount = NATIONAL_MATCH_DAY_COUNTS[scheduleKey];
  const slotLabel = formatSlotTimesLabel(scheduleKey);

  const [matchDays, setMatchDays] = useState<string[]>(() =>
    Array.from({ length: matchDayCount }, () => ""),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setCount = matchDays.filter((d) => d.length > 0).length;
  const complete = setCount >= matchDayCount;

  const loadDates = useCallback(async () => {
    const params = new URLSearchParams({ scope, schedule: scheduleKey });
    const res = await fetch(`/api/admin/competition/dates?${params}`);
    if (!res.ok) return;
    const body = await res.json();
    if (body.matchDays?.length) {
      setMatchDays(body.matchDays);
      return;
    }
    const loaded = (body.dates ?? []) as { round: number; datetime: string }[];
    if (loaded.length === 0) return;
    setMatchDays(collapseRoundsToMatchDays(scheduleKey, loaded));
  }, [scope, scheduleKey]);

  useEffect(() => {
    void loadDates();
  }, [loadDates]);

  async function saveDates() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/competition/dates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, schedule: scheduleKey, matchDays }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error ?? tDates("saveFailed"));
      return;
    }
    setMessage(t("saved"));
    await loadDates();
    onSaved?.();
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900">
          {title ?? t("title", { count: matchDayCount })}
        </h3>
        <span
          className={`text-sm font-medium ${complete ? "text-green-700" : "text-zinc-500"}`}
        >
          {t("daysProgress", { set: setCount, required: matchDayCount })}
        </span>
      </div>
      <p className="text-sm text-zinc-600">
        {t("pickDays", { slotTimes: slotLabel })}
      </p>
      <ul className="flex flex-col gap-2">
        {matchDays.map((day, index) => (
          <li key={index} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm font-medium text-zinc-700">
              {t("matchDay", { index: index + 1 })}
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
          {loading ? tCommon("saving") : t("saveMatchDays")}
        </button>
      )}
      {message && (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
