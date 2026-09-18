"use client";

import { useState, type ReactNode } from "react";

type ModeId = "pair" | "player";

export function ButlerOverallModeTabs({
  pairLabel,
  playerLabel,
  ariaLabel,
  pair,
  player,
}: {
  pairLabel: string;
  playerLabel: string;
  ariaLabel: string;
  pair: ReactNode;
  player: ReactNode;
}) {
  const [active, setActive] = useState<ModeId>("pair");

  const tabs: { id: ModeId; label: string }[] = [
    { id: "pair", label: pairLabel },
    { id: "player", label: playerLabel },
  ];

  return (
    <div className="flex flex-col gap-4">
      <nav
        className="flex gap-1 border-b border-zinc-200"
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`butler-overall-${tab.id}`}
              id={`butler-overall-${tab.id}-trigger`}
              onClick={() => setActive(tab.id)}
              className={[
                "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                selected
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div
        id="butler-overall-pair"
        role="tabpanel"
        aria-labelledby="butler-overall-pair-trigger"
        hidden={active !== "pair"}
        className="pt-1"
      >
        {pair}
      </div>
      <div
        id="butler-overall-player"
        role="tabpanel"
        aria-labelledby="butler-overall-player-trigger"
        hidden={active !== "player"}
        className="pt-1"
      >
        {player}
      </div>
    </div>
  );
}
