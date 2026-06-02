"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeRoundCount,
  maxRoundRobinCountForDates,
  roundsPerCycle,
} from "@/lib/competition/group-round-count";
import {
  REGIONAL_CALENDAR_ROUNDS,
} from "@/lib/competition/group-match-rounds";
import { formatBrusselsRoundHeader } from "@/lib/time/brussels";

type Props = {
  groupId: string;
  teamCount: number;
  roundRobinCount: number;
  roundCount: number;
  onUpdated: () => void;
};

type RegionalDateRow = { round: number; datetime: string };

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
  const [savingDates, setSavingDates] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [regionalDates, setRegionalDates] = useState<RegionalDateRow[]>([]);
  const [usedRounds, setUsedRounds] = useState<Set<number>>(new Set());
  const [datesApplicable, setDatesApplicable] = useState(false);
  const [datesLoading, setDatesLoading] = useState(false);

  const maxRr = maxRoundRobinCountForDates(teamCount, REGIONAL_CALENDAR_ROUNDS);
  const previewRounds = computeRoundCount(teamCount, roundRobinCount);
  const usesRbbfPath = teamCount === 7 || teamCount === 8;

  useEffect(() => {
    setRoundRobinCount(initialRr);
    setRoundCount(initialRc);
  }, [initialRr, initialRc, groupId]);

  useEffect(() => {
    if (usesRbbfPath || roundCount >= REGIONAL_CALENDAR_ROUNDS) {
      setDatesApplicable(false);
      return;
    }

    let cancelled = false;
    setDatesLoading(true);

    (async () => {
      const res = await fetch(
        `/api/admin/competition/groups/${groupId}/match-rounds`,
      );
      if (cancelled) return;
      if (!res.ok) {
        setDatesLoading(false);
        return;
      }
      const body = await res.json();
      if (cancelled) return;
      setRegionalDates(body.regionalDates ?? []);
      setDatesApplicable(body.applicable === true);
      setUsedRounds(new Set(body.usedRounds ?? []));
      setDatesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId, roundCount, usesRbbfPath]);

  const selectionComplete = useMemo(() => {
    if (!datesApplicable) return true;
    return usedRounds.size === roundCount;
  }, [datesApplicable, usedRounds, roundCount]);

  async function save() {
    if (roundRobinCount < 1 || roundRobinCount > maxRr) {
      setMessage(
        `Round-robin count must be between 1 and ${maxRr} (${REGIONAL_CALENDAR_ROUNDS} match dates, ${roundsPerCycle(teamCount)} rounds per cycle).`,
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

  function toggleDate(round: number) {
    setUsedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(round)) {
        next.delete(round);
      } else if (next.size < roundCount) {
        next.add(round);
      }
      return next;
    });
  }

  async function saveDates() {
    if (!selectionComplete) {
      setMessage(`Select exactly ${roundCount} dates from the regional calendar.`);
      return;
    }
    setSavingDates(true);
    setMessage(null);

    const allSkipped: number[] = [];
    for (let r = 1; r <= REGIONAL_CALENDAR_ROUNDS; r++) {
      if (!usedRounds.has(r)) allSkipped.push(r);
    }

    const res = await fetch(
      `/api/admin/competition/groups/${groupId}/match-rounds`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skippedRounds: allSkipped }),
      },
    );
    const body = await res.json();
    setSavingDates(false);
    if (!res.ok) {
      setMessage(body.error ?? "Failed to save date selection");
      return;
    }
    setUsedRounds(new Set(body.usedRounds ?? []));
    setMessage("Match dates saved.");
    onUpdated();
  }

  if (usesRbbfPath) {
    return (
      <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
        <p className="font-medium text-zinc-900">Schedule settings</p>
        <p className="mt-1 text-zinc-600">
          {teamCount} teams · 14-round RBBF template (all regional dates used)
        </p>
        {teamCount === 7 && (
          <p className="mt-2 text-xs text-zinc-600">
            Use the schedule slot order above to place a bye. Teams paired
            against the bye receive 12 VP after the match date.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
      <p className="font-medium text-zinc-900">Schedule settings</p>
      <p className="mt-1 text-zinc-600">
        {teamCount} teams · {roundsPerCycle(teamCount)} rounds per cycle · total{" "}
        {roundCount} fixture rounds
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

      {datesApplicable && (
        <div className="mt-4 border-t border-zinc-200 pt-3">
          <p className="font-medium text-zinc-900">Regional match dates</p>
          <p className="mt-1 text-xs text-zinc-600">
            Choose {roundCount} of the 14 shared regional dates for this group.
            Dates are configured in the regional calendar above.
          </p>
          {datesLoading ? (
            <p className="mt-2 text-xs text-zinc-500">Loading dates…</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {regionalDates.map((d) => {
                const { date, time } = formatBrusselsRoundHeader(d.datetime);
                const checked = usedRounds.has(d.round);
                const atCapacity =
                  !checked && usedRounds.size >= roundCount;
                return (
                  <li key={d.round} className="flex items-center gap-2">
                    <label className="flex flex-1 cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-zinc-100">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={atCapacity}
                        onChange={() => toggleDate(d.round)}
                      />
                      <span className="text-zinc-700">
                        Round {d.round}: {date} {time}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {!selectionComplete && !datesLoading && (
            <p className="mt-2 text-xs text-amber-800">
              Select {roundCount - usedRounds.size} more date
              {roundCount - usedRounds.size === 1 ? "" : "s"} before generating
              the schedule.
            </p>
          )}
          <button
            type="button"
            onClick={saveDates}
            disabled={savingDates || !selectionComplete || datesLoading}
            className="btn-secondary mt-2 text-xs"
          >
            {savingDates ? "Saving…" : "Save date selection"}
          </button>
        </div>
      )}

      {message && <p className="mt-2 text-xs text-zinc-700">{message}</p>}
    </div>
  );
}
