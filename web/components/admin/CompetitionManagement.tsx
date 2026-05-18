"use client";

import { useState } from "react";
import { toDatetimeLocalValue } from "@/lib/time/brussels";
import type { CompetitionScope } from "@/lib/competition/scopes";

type RoundDate = { round: number; datetime: string };

type Props = {
  scope: CompetitionScope;
  regionCode?: string;
};

export function CompetitionManagement({ scope, regionCode }: Props) {
  const [dates, setDates] = useState<RoundDate[]>(
    Array.from({ length: 14 }, (_, i) => ({ round: i + 1, datetime: "" })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadDates() {
    const params = new URLSearchParams({ scope });
    if (regionCode) params.set("region", regionCode);
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
      body: JSON.stringify({ scope, region: regionCode, rounds: dates }),
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
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Match dates (14 rounds)</h2>
        <button
          type="button"
          onClick={loadDates}
          className="text-sm text-zinc-600 underline"
        >
          Reload
        </button>
      </div>
      <p className="text-sm text-zinc-500">Times in Europe/Brussels</p>
      <ul className="flex flex-col gap-2">
        {dates.map((d) => (
          <li key={d.round} className="flex items-center gap-3">
            <span className="w-16 text-sm font-medium">Round {d.round}</span>
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
              className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={loading}
        onClick={saveDates}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save dates"}
      </button>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </section>
  );
}
