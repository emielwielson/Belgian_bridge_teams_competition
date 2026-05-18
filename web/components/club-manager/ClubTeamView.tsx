"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ClubTeamDetail } from "@/lib/competition/club-manager-queries";
import { formatBrussels } from "@/lib/time/brussels";

type Props = {
  clubId: string;
  teamId: string;
};

export function ClubTeamView({ clubId, teamId }: Props) {
  const [detail, setDetail] = useState<ClubTeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [captainId, setCaptainId] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/clubs/${clubId}/teams/${teamId}`);
    if (res.ok) {
      const body = (await res.json()) as ClubTeamDetail;
      setDetail(body);
      setLocation(body.team.location ?? "");
      setCaptainId(body.team.captain_id ?? "");
      setMessage(null);
    } else {
      const err = await res.json();
      setMessage(err.error ?? "Failed to load team");
    }
    setLoading(false);
  }, [clubId, teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const rosterEditable = detail?.roster_editable ?? false;

  async function saveTeamSettings() {
    const res = await fetch(`/api/clubs/${clubId}/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: location.trim() || null,
        captain_id: captainId || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error ?? "Failed to update team");
      return;
    }
    setMessage(null);
    await load();
  }

  async function addToRoster(playerId: string) {
    const res = await fetch(`/api/clubs/${clubId}/teams/${teamId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: playerId }),
    });
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error ?? "Failed to add player");
      return;
    }
    await load();
  }

  async function removeFromRoster(playerId: string) {
    const res = await fetch(`/api/clubs/${clubId}/teams/${teamId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "roster_remove", player_id: playerId }),
    });
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error ?? "Failed to remove player");
      return;
    }
    await load();
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading…</p>;
  }

  if (!detail) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {message ?? "Team not found"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">{detail.team.name}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {detail.team.league_name} · {detail.team.division_name} ·{" "}
          {detail.team.group_name}
        </p>
      </header>

      {message ? (
        <p className="text-sm text-red-600" role="alert">
          {message}
        </p>
      ) : null}

      <section className="card flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-zinc-900">Team settings</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">Location (match venue)</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">Captain</span>
          <select
            value={captainId}
            onChange={(e) => setCaptainId(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2"
          >
            <option value="">No captain</option>
            {detail.roster.map((p) => (
              <option key={p.player_id} value={p.player_id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={saveTeamSettings} className="btn-primary w-fit">
          Save settings
        </button>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Roster</h2>
        {!rosterEditable ? (
          <p className="text-sm text-zinc-600">
            Roster changes are locked while the season is active.
          </p>
        ) : (
          <p className="text-sm text-zinc-600">
            Add unassigned club members to this team.
          </p>
        )}
        {detail.roster.length === 0 ? (
          <p className="text-sm text-zinc-500">No players on this team yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {detail.roster.map((player) => (
              <li
                key={player.player_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-100 px-3 py-2"
              >
                <span className="font-medium text-zinc-900">
                  {player.name}
                  {player.player_id === detail.team.captain_id ? (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Captain
                    </span>
                  ) : null}
                </span>
                {rosterEditable ? (
                  <button
                    type="button"
                    onClick={() => removeFromRoster(player.player_id)}
                    className="text-xs text-amber-700 hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {rosterEditable ? (
          <div className="mt-4 flex flex-col gap-4 border-t border-zinc-100 pt-4">
            <h3 className="text-sm font-medium text-zinc-900">Add from club</h3>
            {detail.available_players.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {detail.available_players.map((player) => (
                  <li
                    key={player.player_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-100 px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-900">{player.name}</span>
                    <button
                      type="button"
                      onClick={() => addToRoster(player.player_id)}
                      className="btn-secondary py-1 text-xs"
                    >
                      Add to team
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">
                No unassigned club members available to add.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Matches</h2>
        <p className="text-sm text-zinc-600">
          Open a match to set lineups and submit scores (same as team captain).
        </p>
        {detail.matches.length === 0 ? (
          <p className="text-sm text-zinc-500">No matches scheduled yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {detail.matches.map((match) => (
              <li key={match.id}>
                <Link
                  href={`/player/matches/${match.id}`}
                  className="block rounded-md border border-zinc-100 px-3 py-3 transition-colors hover:border-zinc-300"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-zinc-900">
                      Round {match.round}
                    </span>
                    <span
                      className={
                        match.played_at
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                          : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
                      }
                    >
                      {match.played_at ? "Played" : "Scheduled"}
                    </span>
                  </div>
                  <p className="mt-1 text-zinc-600">{formatBrussels(match.datetime)}</p>
                  <p className="mt-1 text-zinc-900">
                    {match.is_home ? "Home vs" : "Away at"}{" "}
                    <span className="font-medium">{match.opponent_name}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
