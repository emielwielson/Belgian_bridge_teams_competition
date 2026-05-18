"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  isHomeAwaySwitchCaptain,
  type MatchHomeAwaySwitchState,
} from "@/lib/competition/home-away-switch";

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

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    if (!requestingTeamId) {
      setError("Choose which team you represent");
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
      setError(body.error ?? "Failed to propose home/away switch");
      return;
    }
    const body = (await res.json()) as { state: MatchHomeAwaySwitchState };
    setState(body.state);
    setMessage(
      "Home/away switch proposed. The other captain can approve or reject on this match page.",
    );
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
      setError(body.error ?? `Failed to ${action}`);
      return;
    }
    const body = (await res.json()) as { state: MatchHomeAwaySwitchState };
    setState(body.state);
    if (action === "approve") {
      setMessage("Home and away teams swapped for this return leg.");
      router.refresh();
    } else if (action === "reject") {
      setMessage("Home/away switch request rejected.");
    } else {
      setMessage("Home/away switch request cancelled.");
    }
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">
          Home/away for return leg
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Rounds 8–14 are the return leg: the away team from the first meeting
          should host. Use this section when the match still lists the same home
          team as in round {state.first_leg_round ?? "the first leg"}.
        </p>
      </div>

      {firstLeg && state.first_leg_round != null ? (
        <p className="text-sm text-zinc-600">
          Round {state.first_leg_round} (first leg):{" "}
          <span className="font-medium">
            {teamLabel(firstLeg.home_team_id)} (home) vs{" "}
            {teamLabel(firstLeg.away_team_id)} (away)
          </span>
          . This match (round {state.round}):{" "}
          <span className="font-medium">
            {teamLabel(state.home_team_id)} (home) vs{" "}
            {teamLabel(state.away_team_id)} (away)
          </span>
          .
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

      {!isCaptain ? (
        <p className="text-sm text-zinc-600">
          Only the home or away <span className="font-medium">team captain</span>{" "}
          can propose or approve a swap. Log in with the captain&apos;s account,
          or ask your club manager to assign you as captain on the team.
        </p>
      ) : !state.needs_switch && !state.pending ? (
        <p className="text-sm text-zinc-600">
          Home/away is already correct for this return leg (home and away are
          swapped compared with the first leg). No action is needed unless the
          fixture was entered incorrectly.
        </p>
      ) : state.pending ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
          <p className="font-medium text-amber-900">Pending approval</p>
          <p className="mt-1 text-amber-800">
            {teamLabel(state.pending.requesting_team_id)} proposed swapping home
            and away. The match still lists{" "}
            <span className="font-medium">
              {teamLabel(state.home_team_id)} (home) vs{" "}
              {teamLabel(state.away_team_id)} (away)
            </span>{" "}
            until approved.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.can_approve ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRespond("approve")}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                Approve swap
              </button>
            ) : null}
            {state.can_reject ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRespond("reject")}
                className="btn-secondary px-3 py-1.5 text-sm"
              >
                Reject
              </button>
            ) : null}
            {state.can_cancel ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRespond("cancel")}
                className="text-sm text-zinc-600 hover:underline"
              >
                Cancel request
              </button>
            ) : null}
          </div>
        </div>
      ) : state.can_propose ? (
        <form onSubmit={handlePropose} className="flex flex-col gap-3">
          {state.captain_teams.length > 1 ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600">Proposing as</span>
              <select
                value={requestingTeamId}
                onChange={(e) => setRequestingTeamId(e.target.value)}
                className="input"
                required
              >
                <option value="">Select team</option>
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
            {busy ? "Sending…" : "Propose home/away swap"}
          </button>
        </form>
      ) : isCaptain && state.needs_switch ? (
        <p className="text-sm text-amber-800">
          A postponement may be pending, or this match cannot accept a new
          request right now.
        </p>
      ) : null}
    </section>
  );
}
