"use client";

import { useState } from "react";
import { ArbiterRequestWorkflow } from "@/components/matches/ArbiterRequestWorkflow";
import { HomeAwaySwitchWorkflow } from "@/components/matches/HomeAwaySwitchWorkflow";
import type { MatchHomeAwaySwitchState } from "@/lib/competition/home-away-switch";

type HomeAwayProps = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  initialState: MatchHomeAwaySwitchState;
};

type Props = {
  matchId: string;
  showArbiter: boolean;
  showHomeAwaySwitch: boolean;
  homeAwaySwitch: HomeAwayProps | null;
};

export function MatchSecondaryWorkflows({
  matchId,
  showArbiter,
  showHomeAwaySwitch,
  homeAwaySwitch,
}: Props) {
  const [arbiterOpen, setArbiterOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  if (!showArbiter && !showHomeAwaySwitch) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {showArbiter ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            aria-expanded={arbiterOpen}
            onClick={() => setArbiterOpen((open) => !open)}
          >
            {arbiterOpen ? "Hide arbiter request" : "Request arbiter"}
          </button>
        ) : null}
        {showHomeAwaySwitch ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            aria-expanded={switchOpen}
            onClick={() => setSwitchOpen((open) => !open)}
          >
            {switchOpen ? "Hide home/away swap" : "Home/away swap"}
          </button>
        ) : null}
      </div>

      {arbiterOpen && showArbiter ? (
        <ArbiterRequestWorkflow matchId={matchId} />
      ) : null}

      {switchOpen && showHomeAwaySwitch && homeAwaySwitch ? (
        <HomeAwaySwitchWorkflow key={matchId} {...homeAwaySwitch} />
      ) : null}
    </section>
  );
}
