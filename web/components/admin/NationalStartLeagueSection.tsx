"use client";

import { useState } from "react";
import type { NationalReadiness } from "@/lib/competition/national-readiness";
import { NATIONAL_SCHEDULE_LABELS } from "@/lib/competition/national-structure";

type Props = {
  readiness: NationalReadiness | null;
  loading?: boolean;
  onStart: () => Promise<void>;
};

export function NationalStartLeagueSection({
  readiness,
  loading = false,
  onStart,
}: Props) {
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isSetup = readiness?.seasonStatus === "setup";
  const canStart = readiness?.canStartLeague ?? false;

  async function handleStart() {
    if (!canStart) return;
    if (
      !confirm(
        "Generate fixtures for all 8 divisions and start the league? Rosters will be locked after this.",
      )
    ) {
      return;
    }
    setStarting(true);
    setMessage(null);
    try {
      await onStart();
      setMessage("League started. Fixtures generated and season is now active.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to start league");
    } finally {
      setStarting(false);
    }
  }

  if (!readiness) {
    return (
      <section className="card">
        <p className="text-sm text-zinc-600">Loading readiness…</p>
      </section>
    );
  }

  if (!isSetup) {
    return (
      <section className="card flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">League status</h2>
        <p className="text-sm text-zinc-600">
          The season is <strong>{readiness.seasonStatus}</strong>. Setup is
          complete; match days and teams are locked.
        </p>
      </section>
    );
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Start league</h2>
        <p className="mt-1 text-sm text-zinc-600">
          When match days and teams are complete, generate all fixtures and
          activate the season.
        </p>
      </div>

      <ul className="space-y-2 text-sm text-zinc-800">
        <CheckItem
          ok={readiness.structureReady}
          label="National structure (8 divisions)"
        />
        <CheckItem
          ok={readiness.calendars.honor.complete}
          label={`Honor match days: ${readiness.calendars.honor.set}/${readiness.calendars.honor.required}`}
        />
        <CheckItem
          ok={readiness.calendars.first.complete}
          label={`1st Division match days: ${readiness.calendars.first.set}/${readiness.calendars.first.required}`}
        />
        <CheckItem
          ok={readiness.calendars.default.complete}
          label={`2nd & 3rd match days: ${readiness.calendars.default.set}/${readiness.calendars.default.required}`}
        />
        {readiness.divisions.map((d) => (
          <CheckItem
            key={d.name}
            ok={d.complete}
            label={`${d.name}: ${d.teamCount}/${d.required} teams`}
          />
        ))}
      </ul>

      {readiness.blockers.length > 0 && !canStart && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">Still needed:</p>
          <ul className="mt-1 list-inside list-disc">
            {readiness.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        disabled={!canStart || starting || loading}
        onClick={handleStart}
        className="btn-danger w-fit disabled:opacity-50"
        title={
          canStart
            ? undefined
            : readiness.blockers[0] ?? "Complete setup first"
        }
      >
        {starting ? "Starting…" : "Start league"}
      </button>

      {message && (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      )}

      <p className="text-xs text-zinc-500">
        Calendars: {NATIONAL_SCHEDULE_LABELS.honor};{" "}
        {NATIONAL_SCHEDULE_LABELS.first}; {NATIONAL_SCHEDULE_LABELS.default}.
      </p>
    </section>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${ok ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-600"}`}
        aria-hidden
      >
        {ok ? "✓" : "·"}
      </span>
      {label}
    </li>
  );
}

