"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ClubOverview } from "@/lib/competition/club-manager-queries";

type Props = {
  clubId: string;
};

export function ClubOverviewView({ clubId }: Props) {
  const [overview, setOverview] = useState<ClubOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/clubs/${clubId}/overview`);
    if (res.ok) {
      const body = (await res.json()) as ClubOverview;
      setOverview(body);
      setLocation(body.club.location ?? "");
      setMessage(null);
    } else {
      const err = await res.json();
      setMessage(err.error ?? "Failed to load club");
    }
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading…</p>;
  }

  if (!overview) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {message ?? "Club not found"}
      </p>
    );
  }

  const seasonLocked = overview.season?.status !== "setup";

  async function saveLocation() {
    setSavingLocation(true);
    const res = await fetch(`/api/clubs/${clubId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: location.trim() || null }),
    });
    setSavingLocation(false);
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error ?? "Failed to update location");
      return;
    }
    setMessage(null);
    await load();
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="card flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">Club info</h2>
        <p className="text-lg font-medium text-zinc-900">{overview.club.name}</p>
        {overview.club.region ? (
          <p className="text-sm text-zinc-600">
            {overview.club.region.name} ({overview.club.region.code})
          </p>
        ) : null}
        {overview.season ? (
          <p className="text-sm text-zinc-600">
            Season: {overview.season.name}
            {seasonLocked ? " · roster locked" : " · setup (roster editable)"}
          </p>
        ) : null}
        <label className="mt-4 flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">Location (match venue for all club teams)</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Address or venue name"
            className="rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
        <button
          type="button"
          onClick={saveLocation}
          disabled={savingLocation}
          className="btn-primary mt-2 w-fit"
        >
          {savingLocation ? "Saving…" : "Save location"}
        </button>
      </section>

      {message ? (
        <p className="text-sm text-red-600" role="alert">
          {message}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Teams</h2>
        {overview.teams.length === 0 ? (
          <p className="text-sm text-zinc-500">No teams for this club yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.teams.map((team) => (
              <li key={team.id}>
                <Link
                  href={`/club-manager/${clubId}/teams/${team.id}`}
                  className="card block transition-colors hover:border-zinc-300"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-zinc-900">{team.name}</span>
                    <span className="text-xs text-zinc-500">
                      {team.roster_count} player{team.roster_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">
                    {team.league_name} · {team.division_name} · {team.group_name}
                  </p>
                  {team.captain_name ? (
                    <p className="mt-1 text-sm text-zinc-600">
                      Captain: {team.captain_name}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Players</h2>
        <p className="text-sm text-zinc-600">
          Players are registered by the competition administrator. Roster changes
          are blocked once the season is active.
        </p>
        {overview.players.length === 0 ? (
          <p className="text-sm text-zinc-500">No players registered yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {overview.players.map((player) => (
              <li key={player.membership_id} className="card py-2">
                <span className="text-zinc-900">{player.name}</span>
                {player.member_number ? (
                  <span className="text-zinc-600"> · {player.member_number}</span>
                ) : null}
                {player.team_name ? (
                  <span className="ml-2 text-zinc-600">→ {player.team_name}</span>
                ) : (
                  <span className="ml-2 text-zinc-500">· no team</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
