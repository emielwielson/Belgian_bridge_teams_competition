"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  hasHomeAwaySwitchRespondActions,
  isHomeAwaySwitchCaptain,
  type MatchHomeAwaySwitchState,
} from "@/lib/competition/home-away-switch";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";

type Props = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  initialState: MatchHomeAwaySwitchState;
};

export function HomeAwaySwitchWorkflow({
  matchId,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
  initialState,
}: Props) {
  const t = useTranslations("match.homeAwaySwitch");
  const tCommon = useTranslations("common");
  const translateApiError = useTranslateApiError();
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestingTeamId, setRequestingTeamId] = useState(() =>
    initialState.captain_teams.length === 1
      ? initialState.captain_teams[0]
      : "",
  );
  const [busy, setBusy] = useState(false);

  const teamLabel = (teamId: string) =>
    teamId === homeTeamId ? homeTeamName : awayTeamName;

  const firstLeg = state.first_leg;
  const isCaptain = isHomeAwaySwitchCaptain(state);
  const canRespond = hasHomeAwaySwitchRespondActions(state);

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    if (!requestingTeamId) {
      setError(t("chooseTeam"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/matches/${matchId}/switch-home-away`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesting_team_id: requestingTeamId }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ? translateApiError(body.error) : t("proposeFailed"));
      return;
    }
    const body = (await res.json()) as { state: MatchHomeAwaySwitchState };
    setState(body.state);
    setMessage(t("proposedSuccess"));
  }

  async function handleRespond(action: "approve" | "reject" | "cancel") {
    if (!state.pending) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/matches/${matchId}/switch-home-away`, {
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
    const body = (await res.json()) as { state: MatchHomeAwaySwitchState };
    setState(body.state);
    if (action === "approve") {
      setMessage(t("approved"));
      router.refresh();
    } else if (action === "reject") {
      setMessage(t("rejected"));
    } else {
      setMessage(t("cancelled"));
    }
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
      </div>

      {firstLeg && state.first_leg_round != null ? (
        <p className="text-sm text-zinc-600">
          {t("firstLegLine", {
            firstLegRound: state.first_leg_round,
            firstLegHome: teamLabel(firstLeg.home_team_id),
            firstLegAway: teamLabel(firstLeg.away_team_id),
            round: state.round,
            currentHome: teamLabel(state.home_team_id),
            currentAway: teamLabel(state.away_team_id),
          })}
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

      {state.pending ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
          <p className="font-medium text-amber-900">{t("pendingTitle")}</p>
          <p className="mt-1 text-amber-800">
            {t("pendingBody", {
              requestingTeam: teamLabel(state.pending.requesting_team_id),
              homeTeam: teamLabel(state.home_team_id),
              awayTeam: teamLabel(state.away_team_id),
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
                {t("approveSwap")}
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
          {state.needs_switch ? (
            <p className="text-sm text-zinc-600">
              {t("needsSwitchHint", {
                firstLegRound: state.first_leg_round ?? 0,
              })}
            </p>
          ) : (
            <p className="text-sm text-amber-800">
              {t("alreadySwappedHint", {
                firstLegRound: state.first_leg_round ?? 0,
              })}
            </p>
          )}
          {state.captain_teams.length > 1 ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600">{t("proposingAs")}</span>
              <select
                value={requestingTeamId}
                onChange={(e) => setRequestingTeamId(e.target.value)}
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
          <button
            type="submit"
            disabled={busy || !requestingTeamId}
            className="btn-primary w-fit disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:opacity-100 hover:disabled:bg-zinc-400"
          >
            {busy ? t("sending") : t("proposeSwap")}
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
