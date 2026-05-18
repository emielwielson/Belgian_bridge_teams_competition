"use client";

import { useState } from "react";
import { toDatetimeLocalValue } from "@/lib/time/brussels";
import type { NationalScheduleKey } from "@/lib/competition/national-structure";
import type { CompetitionScope } from "@/lib/competition/scopes";

type RoundDate = { round: number; datetime: string };

type Props = {
  scope: CompetitionScope;
  regionCode?: string;
  scheduleKey?: NationalScheduleKey;
  title?: string;
};

export function CompetitionManagement({
  scope,
  regionCode,
  scheduleKey,
  title,
}: Props) {
  const [dates, setDates] = useState<RoundDate[]>(
    Array.from({ length: 14 }, (_, i) => ({ round: i + 1, datetime: "" })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadDates() {
    const params = new URLSearchParams({ scope });
    if (regionCode) params.set("region", regionCode);
    if (scheduleKey) params.set("schedule", scheduleKey);
    const res = await fetch(`/api/admin/competition/dates?${params}`);
    if (!res.ok) return;
    const body = await res.json();
    const loaded = (body.dates ?? []) as { round: number; datetime: string }[];
    if (loaded.length === 0) return;
    setDates(
      Array.from({ length: 14 }, (_, i) => {
        const row = loaded.find((d) => d.round === i + 1);
        return {
          round: i + 1,
          datetime: row ? toDatetimeLocalValue(row.datetime) : "",
        };
      }),
    );
  }

  async function saveDates() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/competition/dates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        region: regionCode,
        schedule: scheduleKey,
        rounds: dates,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error ?? "Failed to save dates");
      return;
    }
    setMessage("Match dates saved.");
    await loadDates();
  }

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">
          {title ?? "Match dates (14 rounds)"}
        </h2>
        <button type="button" onClick={loadDates} className="link-back">
          Reload
        </button>
      </div>
      <p className="text-sm text-zinc-600">Times in Europe/Brussels</p>
      <ul className="flex flex-col gap-2">
        {dates.map((d) => (
          <li key={d.round} className="flex items-center gap-3">
            <span className="w-16 text-sm font-medium text-zinc-700">
              Round {d.round}
            </span>
            <input
              type="datetime-local"
              value={d.datetime}
              onChange={(e) =>
                setDates((prev) =>
                  prev.map((row) =>
                    row.round === d.round
                      ? { ...row, datetime: e.target.value }
                      : row,
                  ),
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
        {loading ? "Saving…" : "Save dates"}
      </button>
      {message && (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
