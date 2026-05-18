"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { MatchHomeAwaySwitchState } from "@/lib/competition/home-away-switch";

type Props = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
};

export function HomeAwaySwitchWorkflow({
  matchId,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<MatchHomeAwaySwitchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestingTeamId, setRequestingTeamId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/matches/${matchId}/switch-home-away`);
    if (res.status === 403) {
      setState(null);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to load home/away switch state");
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { state: MatchHomeAwaySwitchState };
    setState(body.state);
    if (body.state.captain_teams.length === 1) {
      setRequestingTeamId(body.state.captain_teams[0]);
    }
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!state?.pending) return;
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

  if (loading) {
    return (
      <section className="card">
        <p className="text-sm text-zinc-500">Loading home/away options…</p>
      </section>
    );
  }

  if (!state) {
    return null;
  }

  const teamLabel = (teamId: string) =>
    teamId === homeTeamId ? homeTeamName : awayTeamName;

  const showSection =
    state.can_propose ||
    state.can_approve ||
    state.can_reject ||
    state.can_cancel ||
    state.pending != null ||
    (!state.needs_switch && state.played_at == null);

  if (!showSection) {
    return null;
  }

  const firstLeg = state.first_leg;
  const played = state.played_at != null;

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">
          Home/away for return leg
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          In mirror rounds (8–14), the return leg should be played at the other
          team&apos;s venue. Swap home and away here if this match still shows
          the same sides as the first leg.
        </p>
      </div>

      {firstLeg && state.first_leg_round != null ? (
        <p className="text-sm text-zinc-600">
          Round {state.first_leg_round} (first leg):{" "}
          <span className="font-medium">
            {teamLabel(firstLeg.home_team_id)} (home) vs{" "}
            {teamLabel(firstLeg.away_team_id)} (away)
          </span>
          . Current match:{" "}
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

      {played ? (
        <p className="text-sm text-zinc-500">
          This match has been played; home/away can no longer be changed.
        </p>
      ) : !state.needs_switch && !state.pending ? (
        <p className="text-sm text-zinc-600">
          Home/away is already set correctly for this return leg.
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
      ) : null}
    </section>
  );
}
