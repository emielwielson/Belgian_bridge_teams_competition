"use client";

import Link from "next/link";
import { useState } from "react";

export type ButlerModeRound = {
  tournamentRound: number;
  firstBoardId: string | null;
};

type Mode = "hands" | "frequency";

export function ButlerModeRoundNav({
  rounds,
  handsLabel,
  frequencyLabel,
  selectRoundLabel,
  modeAriaLabel,
  roundAriaLabel,
}: {
  rounds: ButlerModeRound[];
  handsLabel: string;
  frequencyLabel: string;
  selectRoundLabel: string;
  modeAriaLabel: string;
  roundAriaLabel: string;
}) {
  const [mode, setMode] = useState<Mode | null>(null);

  if (rounds.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-3">
      <nav className="flex flex-wrap gap-2" aria-label={modeAriaLabel}>
        <button
          type="button"
          aria-pressed={mode === "hands"}
          onClick={() => setMode("hands")}
          className={mode === "hands" ? "btn-primary" : "btn-secondary"}
        >
          {handsLabel}
        </button>
        <button
          type="button"
          aria-pressed={mode === "frequency"}
          onClick={() => setMode("frequency")}
          className={mode === "frequency" ? "btn-primary" : "btn-secondary"}
        >
          {frequencyLabel}
        </button>
      </nav>

      {mode ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-600">{selectRoundLabel}</p>
          <nav className="flex flex-wrap gap-1.5" aria-label={roundAriaLabel}>
            {rounds.map((r) => {
              const label = `R${r.tournamentRound}`;
              if (mode === "hands") {
                return (
                  <Link
                    key={r.tournamentRound}
                    href={`/butler/rounds/${r.tournamentRound}/hands`}
                    className="chip"
                  >
                    {label}
                  </Link>
                );
              }
              if (r.firstBoardId) {
                return (
                  <Link
                    key={r.tournamentRound}
                    href={`/butler/boards/${r.firstBoardId}`}
                    className="chip"
                  >
                    {label}
                  </Link>
                );
              }
              return (
                <span
                  key={r.tournamentRound}
                  className="chip-disabled"
                  aria-disabled="true"
                >
                  {label}
                </span>
              );
            })}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
