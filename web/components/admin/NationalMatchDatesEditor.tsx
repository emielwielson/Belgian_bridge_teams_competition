"use client";

import { useState } from "react";
import {
  collapseRoundsToMatchDays,
  expandMatchDaysToRounds,
  formatSlotTimesLabel,
  NATIONAL_MATCH_DAY_COUNTS,
} from "@/lib/competition/national-match-schedule";
import type { NationalScheduleKey } from "@/lib/competition/national-structure";
import type { CompetitionScope } from "@/lib/competition/scopes";

type Props = {
  scope: CompetitionScope;
  scheduleKey: NationalScheduleKey;
  title?: string;
};

export function NationalMatchDatesEditor({ scope, scheduleKey, title }: Props) {
  const matchDayCount = NATIONAL_MATCH_DAY_COUNTS[scheduleKey];
  const slotLabel = formatSlotTimesLabel(scheduleKey);

  const [matchDays, setMatchDays] = useState<string[]>(() =>
    Array.from({ length: matchDayCount }, () => ""),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadDates() {
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
  }

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
      setMessage(err.error ?? "Failed to save dates");
      return;
    }
    setMessage("Match days saved.");
    await loadDates();
  }

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">
          {title ?? `Match days (${matchDayCount})`}
        </h2>
        <button type="button" onClick={loadDates} className="link-back">
          Reload
        </button>
      </div>
      <p className="text-sm text-zinc-600">
        Pick match days only (Europe/Brussels). Start times are fixed: {slotLabel}.
      </p>
      <ul className="flex flex-col gap-2">
        {matchDays.map((day, index) => (
          <li key={index} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm font-medium text-zinc-700">
              Match day {index + 1}
            </span>
            <input
              type="date"
              value={day}
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
      <button
        type="button"
        disabled={loading}
        onClick={saveDates}
        className="btn-primary w-fit"
      >
        {loading ? "Saving…" : "Save match days"}
      </button>
      {message && (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
