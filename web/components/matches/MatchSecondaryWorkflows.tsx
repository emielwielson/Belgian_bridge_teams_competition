"use client";

import { useState } from "react";
import { ArbiterRequestWorkflow } from "@/components/matches/ArbiterRequestWorkflow";
import { HomeAwaySwitchWorkflow } from "@/components/matches/HomeAwaySwitchWorkflow";
import { PostponeWorkflow } from "@/components/matches/PostponeWorkflow";
import type { MatchHomeAwaySwitchState } from "@/lib/competition/home-away-switch";

type TeamPairProps = {
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
};

type HomeAwayProps = TeamPairProps & {
  matchId: string;
  initialState: MatchHomeAwaySwitchState;
};

type Props = {
  matchId: string;
  showPostpone: boolean;
  showArbiter: boolean;
  showHomeAwaySwitch: boolean;
  postpone: TeamPairProps | null;
  homeAwaySwitch: HomeAwayProps | null;
};

export function MatchSecondaryWorkflows({
  matchId,
  showPostpone,
  showArbiter,
  showHomeAwaySwitch,
  postpone,
  homeAwaySwitch,
}: Props) {
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [arbiterOpen, setArbiterOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  if (!showPostpone && !showArbiter && !showHomeAwaySwitch) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {showPostpone ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            aria-expanded={postponeOpen}
            onClick={() => setPostponeOpen((open) => !open)}
          >
            {postponeOpen ? "Hide reschedule" : "Reschedule match"}
          </button>
        ) : null}
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

      {postponeOpen && showPostpone && postpone ? (
        <PostponeWorkflow matchId={matchId} {...postpone} />
      ) : null}

      {arbiterOpen && showArbiter ? (
        <ArbiterRequestWorkflow matchId={matchId} />
      ) : null}

      {switchOpen && showHomeAwaySwitch && homeAwaySwitch ? (
        <HomeAwaySwitchWorkflow key={matchId} {...homeAwaySwitch} />
      ) : null}
    </section>
  );
}
