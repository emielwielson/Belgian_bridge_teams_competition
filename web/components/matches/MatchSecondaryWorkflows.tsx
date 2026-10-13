"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArbiterRequestWorkflow } from "@/components/matches/ArbiterRequestWorkflow";
import { LocationChangeWorkflow } from "@/components/matches/LocationChangeWorkflow";
import { PostponeWorkflow } from "@/components/matches/PostponeWorkflow";
import type { MatchLocationChangeState } from "@/lib/competition/location-change";
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

type LocationChangeProps = TeamPairProps & {
  matchId: string;
  currentVenue: string | null;
  homeTeamVenue: string | null;
  awayTeamVenue: string | null;
  initialState: MatchLocationChangeState;
};

type OpenPanel = "postpone" | "arbiter" | "location" | null;

type Props = {
  matchId: string;
  showPostpone: boolean;
  showArbiter: boolean;
  showLocationChange: boolean;
  postpone: PostponeProps | null;
  locationChange: LocationChangeProps | null;
};

function initialOpenPanel(
  postponePending: boolean,
  locationPending: boolean,
): OpenPanel {
  if (postponePending) return "postpone";
  if (locationPending) return "location";
  return null;
}

export function MatchSecondaryWorkflows({
  matchId,
  showPostpone,
  showArbiter,
  showLocationChange,
  postpone,
  locationChange,
}: Props) {
  const t = useTranslations("match.workflows");
  const [postponePending, setPostponePending] = useState(
    () => postpone?.initialState.pending != null,
  );
  const [locationPending, setLocationPending] = useState(
    () => locationChange?.initialState.pending != null,
  );
  const [openPanel, setOpenPanel] = useState<OpenPanel>(() =>
    initialOpenPanel(
      postpone?.initialState.pending != null,
      locationChange?.initialState.pending != null,
    ),
  );

  function togglePanel(panel: Exclude<OpenPanel, null>) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  if (!showPostpone && !showArbiter && !showLocationChange) return null;

  const postponeOpen = openPanel === "postpone";
  const arbiterOpen = openPanel === "arbiter";
  const locationOpen = openPanel === "location";

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {showPostpone ? (
          <button
            type="button"
            className={`text-sm ${postponeOpen ? "btn-primary" : "btn-secondary"}`}
            aria-expanded={postponeOpen}
            aria-pressed={postponeOpen}
            onClick={() => togglePanel("postpone")}
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
            className={`text-sm ${arbiterOpen ? "btn-primary" : "btn-secondary"}`}
            aria-expanded={arbiterOpen}
            aria-pressed={arbiterOpen}
            onClick={() => togglePanel("arbiter")}
          >
            {arbiterOpen ? t("hideArbiterRequest") : t("requestArbiter")}
          </button>
        ) : null}
        {showLocationChange ? (
          <button
            type="button"
            className={`text-sm ${locationOpen ? "btn-primary" : "btn-secondary"}`}
            aria-expanded={locationOpen}
            aria-pressed={locationOpen}
            onClick={() => togglePanel("location")}
          >
            {locationOpen
              ? t("hideLocationChange")
              : locationPending
                ? t("pendingLocationChange")
                : t("locationChange")}
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
            setOpenPanel(null);
          }}
        />
      ) : null}

      {arbiterOpen && showArbiter ? (
        <ArbiterRequestWorkflow matchId={matchId} />
      ) : null}

      {locationOpen && showLocationChange && locationChange ? (
        <LocationChangeWorkflow
          key={matchId}
          {...locationChange}
          onPendingChange={setLocationPending}
          onResponded={() => {
            setLocationPending(false);
            setOpenPanel(null);
          }}
        />
      ) : null}
    </section>
  );
}
