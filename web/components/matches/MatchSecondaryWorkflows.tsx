"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArbiterRequestWorkflow } from "@/components/matches/ArbiterRequestWorkflow";
import { HomeAwaySwitchWorkflow } from "@/components/matches/HomeAwaySwitchWorkflow";
import { PostponeWorkflow } from "@/components/matches/PostponeWorkflow";
import type { MatchHomeAwaySwitchState } from "@/lib/competition/home-away-switch";
import type { MatchPostponementState } from "@/lib/competition/postponement";

type TeamPairProps = {
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
};

type PostponeProps = TeamPairProps & {
  initialState: MatchPostponementState;
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
  postpone: PostponeProps | null;
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
  const t = useTranslations("match.workflows");
  const [postponePending, setPostponePending] = useState(
    () => postpone?.initialState.pending != null,
  );
  const [switchPending, setSwitchPending] = useState(
    () => homeAwaySwitch?.initialState.pending != null,
  );
  const [postponeOpen, setPostponeOpen] = useState(postponePending);
  const [arbiterOpen, setArbiterOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(switchPending);

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
            {postponeOpen
              ? t("hideReschedule")
              : postponePending
                ? t("pendingReschedule")
                : t("rescheduleMatch")}
          </button>
        ) : null}
        {showArbiter ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            aria-expanded={arbiterOpen}
            onClick={() => setArbiterOpen((open) => !open)}
          >
            {arbiterOpen ? t("hideArbiterRequest") : t("requestArbiter")}
          </button>
        ) : null}
        {showHomeAwaySwitch ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            aria-expanded={switchOpen}
            onClick={() => setSwitchOpen((open) => !open)}
          >
            {switchOpen
              ? t("hideHomeAwaySwap")
              : switchPending
                ? t("pendingHomeAwaySwap")
                : t("homeAwaySwap")}
          </button>
        ) : null}
      </div>

      {postponeOpen && showPostpone && postpone ? (
        <PostponeWorkflow
          matchId={matchId}
          {...postpone}
          onPendingChange={setPostponePending}
          onResponded={() => {
            setPostponePending(false);
            setPostponeOpen(false);
          }}
        />
      ) : null}

      {arbiterOpen && showArbiter ? (
        <ArbiterRequestWorkflow matchId={matchId} />
      ) : null}

      {switchOpen && showHomeAwaySwitch && homeAwaySwitch ? (
        <HomeAwaySwitchWorkflow
          key={matchId}
          {...homeAwaySwitch}
          onPendingChange={setSwitchPending}
          onResponded={() => {
            setSwitchPending(false);
            setSwitchOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
