"use client";

import { useState } from "react";
import type { ClubSubCandidate } from "@/lib/competition/player-matches";
import { AddSubPicker } from "./AddSubPicker";

type RosterPlayer = {
  id: string;
  name: string;
  member_number: string | null;
};

type LineupEntry = {
  player_id: string;
  is_substitute: boolean;
  player: { id: string; name: string; member_number?: string | null };
};

type SubEntry = {
  player_id: string;
  name: string;
  member_number: string | null;
};

type Props = {
  matchId: string;
  teamId: string;
  teamName: string;
  roster: RosterPlayer[];
  initialLineup: LineupEntry[];
  canEdit: boolean;
};

function subsFromLineup(lineup: LineupEntry[]): SubEntry[] {
  return lineup
    .filter((e) => e.is_substitute)
    .map((e) => ({
      player_id: e.player_id,
      name: e.player.name,
      member_number: e.player.member_number ?? null,
    }));
}

export function MatchLineupEditor({
  matchId,
  teamId,
  teamName,
  roster,
  initialLineup,
  canEdit,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        initialLineup.filter((e) => !e.is_substitute).map((e) => e.player_id),
      ),
  );
  const [subs, setSubs] = useState<SubEntry[]>(() => subsFromLineup(initialLineup));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalCount = selected.size + subs.length;

  function togglePlayer(playerId: string) {
    if (!canEdit) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function removeSub(playerId: string) {
    if (!canEdit) return;
    setSubs((prev) => prev.filter((s) => s.player_id !== playerId));
  }

  function addSub(player: ClubSubCandidate) {
    setSubs((prev) => {
      if (prev.some((s) => s.player_id === player.id)) return prev;
      return [
        ...prev,
        {
          player_id: player.id,
          name: player.name,
          member_number: player.member_number,
        },
      ];
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const players = [
        ...[...selected].map((player_id) => ({
          player_id,
          is_substitute: false,
        })),
        ...subs.map((s) => ({
          player_id: s.player_id,
          is_substitute: true,
        })),
      ];
      const res = await fetch(`/api/matches/${matchId}/players`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId, players }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save lineup");
      setMessage(`Saved ${teamName} lineup (${players.length} players)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const excludeSubIds = subs.map((s) => s.player_id);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{teamName}</h3>

      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Lineup
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Select at least 4 players from your roster.
      </p>
      <ul className="mt-2 space-y-2">
        {roster.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              disabled={!canEdit}
              onChange={() => togglePlayer(p.id)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="flex-1">
              {p.name}
              {p.member_number ? (
                <span className="ml-1 text-zinc-400">({p.member_number})</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {roster.length === 0 ? (
        <p className="mt-2 text-xs text-amber-700">No roster players found.</p>
      ) : null}

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Substitutes
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Add substitutes from your club (not on the team roster).
      </p>
      {subs.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {subs.map((s) => (
            <li
              key={s.player_id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span>
                {s.name}
                {s.member_number ? (
                  <span className="ml-1 text-zinc-400">
                    ({s.member_number})
                  </span>
                ) : null}
              </span>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => removeSub(s.player_id)}
                  className="text-xs font-medium text-red-700 underline"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">No substitutes added.</p>
      )}
      {canEdit ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-2 text-sm font-medium text-emerald-700 underline hover:text-emerald-800"
        >
          + Sub
        </button>
      ) : null}

      {canEdit ? (
        <button
          type="button"
          onClick={save}
          disabled={saving || totalCount < 4}
          className="mt-4 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : `Save lineup (${totalCount})`}
        </button>
      ) : null}
      {totalCount > 0 && totalCount < 4 ? (
        <p className="mt-2 text-xs text-amber-700">Need at least 4 players.</p>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      {pickerOpen && canEdit ? (
        <AddSubPicker
          matchId={matchId}
          teamId={teamId}
          excludePlayerIds={excludeSubIds}
          onSelect={addSub}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </section>
  );
}
