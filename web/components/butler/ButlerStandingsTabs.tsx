"use client";

import { useState, type ReactNode } from "react";

type TabId = "overall" | "byRound";

export function ButlerStandingsTabs({
  overallLabel,
  byRoundLabel,
  ariaLabel,
  overall,
  byRound,
}: {
  overallLabel: string;
  byRoundLabel: string;
  ariaLabel: string;
  overall: ReactNode;
  byRound: ReactNode;
}) {
  const [active, setActive] = useState<TabId>("overall");

  const tabs: { id: TabId; label: string }[] = [
    { id: "overall", label: overallLabel },
    { id: "byRound", label: byRoundLabel },
  ];

  return (
    <div className="mt-8 flex flex-col gap-4">
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
              aria-controls={`butler-tab-${tab.id}`}
              id={`butler-tab-${tab.id}-trigger`}
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
        id="butler-tab-overall"
        role="tabpanel"
        aria-labelledby="butler-tab-overall-trigger"
        hidden={active !== "overall"}
        className="pt-1"
      >
        {overall}
      </div>
      <div
        id="butler-tab-byRound"
        role="tabpanel"
        aria-labelledby="butler-tab-byRound-trigger"
        hidden={active !== "byRound"}
        className="pt-1"
      >
        {byRound}
      </div>
    </div>
  );
}
