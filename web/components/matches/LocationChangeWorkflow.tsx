"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  hasLocationChangeRespondActions,
  isLocationChangeCaptain,
  type MatchLocationChangeState,
} from "@/lib/competition/location-change";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";

const CLOSE_AFTER_RESPOND_MS = 1500;

type LocationMode = "other_team" | "custom";

type Props = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  currentVenue: string | null;
  homeTeamVenue: string | null;
  awayTeamVenue: string | null;
  initialState: MatchLocationChangeState;
  onResponded?: () => void;
  onPendingChange?: (pending: boolean) => void;
};

function otherTeamVenueFor(
  proposingTeamId: string,
  homeTeamId: string,
  homeTeamVenue: string | null,
  awayTeamVenue: string | null,
): string | null {
  if (!proposingTeamId) return null;
  const venue =
    proposingTeamId === homeTeamId ? awayTeamVenue : homeTeamVenue;
  const trimmed = venue?.trim();
  return trimmed ? trimmed : null;
}

export function LocationChangeWorkflow({
  matchId,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
  currentVenue,
  homeTeamVenue,
  awayTeamVenue,
  initialState,
  onResponded,
  onPendingChange,
}: Props) {
  const t = useTranslations("match.locationChange");
  const tCommon = useTranslations("common");
  const translateApiError = useTranslateApiError();
  const router = useRouter();
  const onRespondedRef = useRef(onResponded);
  onRespondedRef.current = onResponded;
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposingTeamId, setProposingTeamId] = useState(() =>
    initialState.captain_teams.length === 1
      ? initialState.captain_teams[0]
      : "",
  );
  const initialOtherVenue = otherTeamVenueFor(
    initialState.captain_teams.length === 1
      ? initialState.captain_teams[0]
      : "",
    homeTeamId,
    homeTeamVenue,
    awayTeamVenue,
  );
  const [locationMode, setLocationMode] = useState<LocationMode>(() =>
    initialOtherVenue ? "other_team" : "custom",
  );
  const [customLocation, setCustomLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingResponse, setConfirmingResponse] = useState(false);

  useEffect(() => {
    if (!confirmingResponse) return;
    const timer = window.setTimeout(() => {
      onRespondedRef.current?.();
    }, CLOSE_AFTER_RESPOND_MS);
    return () => window.clearTimeout(timer);
  }, [confirmingResponse]);

  const teamLabel = (teamId: string) =>
    teamId === homeTeamId ? homeTeamName : awayTeamName;

  const isCaptain = isLocationChangeCaptain(state);
  const canRespond = hasLocationChangeRespondActions(state);
  const displayVenue =
    state.location_override?.trim() || currentVenue?.trim() || null;

  const otherTeamId =
    proposingTeamId === homeTeamId
      ? awayTeamId
      : proposingTeamId === awayTeamId
        ? homeTeamId
        : "";
  const otherTeamVenue = otherTeamVenueFor(
    proposingTeamId,
    homeTeamId,
    homeTeamVenue,
    awayTeamVenue,
  );
  const effectiveLocationMode =
    locationMode === "other_team" && !otherTeamVenue ? "custom" : locationMode;
  const proposedLocation =
    effectiveLocationMode === "other_team" && otherTeamVenue
      ? otherTeamVenue
      : customLocation.trim();

  function handleProposingTeamChange(teamId: string) {
    setProposingTeamId(teamId);
    const nextOther = otherTeamVenueFor(
      teamId,
      homeTeamId,
      homeTeamVenue,
      awayTeamVenue,
    );
    if (nextOther && locationMode === "custom" && !customLocation.trim()) {
      setLocationMode("other_team");
    } else if (!nextOther) {
      setLocationMode("custom");
    }
  }

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    if (!proposingTeamId || !proposedLocation) {
      setError(t("chooseTeamAndLocation"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/matches/${matchId}/change-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proposed_location: proposedLocation,
        proposing_team_id: proposingTeamId,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ? translateApiError(body.error) : t("proposeFailed"));
      return;
    }
    const body = (await res.json()) as { state: MatchLocationChangeState };
    setState(body.state);
    onPendingChange?.(body.state.pending != null);
    setMessage(t("proposedSuccess"));
  }

  async function handleRespond(action: "approve" | "reject" | "cancel") {
    if (!state.pending) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/matches/${matchId}/change-location`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: state.pending.id,
        action,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setError(
        body.error
          ? translateApiError(body.error)
          : t("respondFailed", { action: tCommon(action) }),
      );
      return;
    }
    const body = (await res.json()) as { state: MatchLocationChangeState };
    setState(body.state);
    onPendingChange?.(false);
    if (action === "approve") {
      setMessage(t("approved"));
    } else if (action === "reject") {
      setMessage(t("rejected"));
    } else {
      setMessage(t("cancelled"));
    }
    setConfirmingResponse(true);
    router.refresh();
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">{t("title")}</h2>
        {!confirmingResponse ? (
          <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
        ) : null}
      </div>

      {confirmingResponse ? null : displayVenue ? (
        <p className="text-sm text-zinc-600">
          {t("currentLocation", { location: displayVenue })}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}

      {confirmingResponse ? null : state.pending ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
          <p className="font-medium text-amber-900">{t("pendingTitle")}</p>
          <p className="mt-1 text-amber-800">
            {t("pendingBody", {
              proposingTeam: teamLabel(state.pending.proposing_team_id),
              location: state.pending.proposed_location,
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.can_approve ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRespond("approve")}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                {t("approveChange")}
              </button>
            ) : null}
            {state.can_reject ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRespond("reject")}
                className="btn-secondary px-3 py-1.5 text-sm"
              >
                {tCommon("reject")}
              </button>
            ) : null}
            {state.can_cancel ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRespond("cancel")}
                className="text-sm text-zinc-600 hover:underline"
              >
                {t("cancelRequest")}
              </button>
            ) : null}
          </div>
        </div>
      ) : state.can_propose && isCaptain ? (
        <form onSubmit={handlePropose} className="flex flex-col gap-3">
          {state.captain_teams.length > 1 ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600">{t("proposingAs")}</span>
              <select
                value={proposingTeamId}
                onChange={(e) => handleProposingTeamChange(e.target.value)}
                className="input"
                required
              >
                <option value="">{t("selectTeam")}</option>
                {state.captain_teams.map((id) => (
                  <option key={id} value={id}>
                    {teamLabel(id)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="text-zinc-600">{t("newLocation")}</legend>
            {otherTeamVenue && otherTeamId ? (
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="location-mode"
                  className="mt-1"
                  checked={effectiveLocationMode === "other_team"}
                  onChange={() => setLocationMode("other_team")}
                />
                <span>
                  {t("otherTeamLocation", {
                    team: teamLabel(otherTeamId),
                    location: otherTeamVenue,
                  })}
                </span>
              </label>
            ) : null}
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="location-mode"
                className="mt-1"
                checked={effectiveLocationMode === "custom"}
                onChange={() => setLocationMode("custom")}
              />
              <span className="flex w-full flex-col gap-1">
                <span>{t("customLocation")}</span>
                {effectiveLocationMode === "custom" ? (
                  <input
                    type="text"
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    className="input"
                    required
                  />
                ) : null}
              </span>
            </label>
          </fieldset>

          <button
            type="submit"
            disabled={busy || !proposingTeamId || !proposedLocation}
            className="btn-primary w-fit disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:opacity-100 hover:disabled:bg-zinc-400"
          >
            {busy ? t("sending") : t("proposeChange")}
          </button>
        </form>
      ) : isCaptain && !state.can_propose ? (
        <p className="text-sm text-amber-800">{t("blocked")}</p>
      ) : !isCaptain && !canRespond ? (
        <p className="text-sm text-zinc-600">{t("onlyCaptain")}</p>
      ) : null}
    </section>
  );
}
