"use client";

import { useEffect, useState } from "react";
import {
  computeRoundCount,
  maxRoundRobinCountForDates,
  roundsPerCycle,
} from "@/lib/competition/group-round-count";

type Props = {
  groupId: string;
  teamCount: number;
  roundRobinCount: number;
  roundCount: number;
  onUpdated: () => void;
};

const REGIONAL_DATE_SLOTS = 14;

export function RegionalGroupScheduleSettings({
  groupId,
  teamCount,
  roundRobinCount: initialRr,
  roundCount: initialRc,
  onUpdated,
}: Props) {
  const [roundRobinCount, setRoundRobinCount] = useState(initialRr);
  const [roundCount, setRoundCount] = useState(initialRc);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const maxRr = maxRoundRobinCountForDates(teamCount, REGIONAL_DATE_SLOTS);
  const previewRounds = computeRoundCount(teamCount, roundRobinCount);

  useEffect(() => {
    setRoundRobinCount(initialRr);
    setRoundCount(initialRc);
  }, [initialRr, initialRc, groupId]);

  async function save() {
    if (roundRobinCount < 1 || roundRobinCount > maxRr) {
      setMessage(
        `Round-robin count must be between 1 and ${maxRr} (${REGIONAL_DATE_SLOTS} match dates, ${roundsPerCycle(teamCount)} rounds per cycle).`,
      );
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/competition", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "group",
        id: groupId,
        round_robin_count: roundRobinCount,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(body.error ?? "Failed to save");
      return;
    }
    setRoundCount(previewRounds);
    setMessage("Round-robin count saved.");
    onUpdated();
  }

  return (
    <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
      <p className="font-medium text-zinc-900">Schedule settings</p>
      <p className="mt-1 text-zinc-600">
        {teamCount} teams · {roundsPerCycle(teamCount)} rounds per cycle · total{" "}
        {roundCount} rounds configured
      </p>
      <label className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-zinc-700">Round-robin cycles</span>
        <input
          type="number"
          min={1}
          max={maxRr}
          value={roundRobinCount}
          onChange={(e) => setRoundRobinCount(Number(e.target.value))}
          className="w-16 rounded border border-zinc-300 px-2 py-1"
          disabled={teamCount < 2}
        />
        <span className="text-zinc-500">→ {previewRounds} match rounds</span>
      </label>
      {teamCount % 2 === 1 && (
        <p className="mt-2 text-xs text-zinc-600">
          Odd group size: one team rests each round and receives 12 VP after the
          match date (via automation).
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || teamCount < 2}
          className="btn-secondary text-xs"
        >
          {saving ? "Saving…" : "Save cycles"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-zinc-700">{message}</p>}
    </div>
  );
}
