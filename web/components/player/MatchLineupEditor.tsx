"use client";

import { useState } from "react";

type RosterPlayer = {
  id: string;
  name: string;
  member_number: string | null;
};

type LineupEntry = {
  player_id: string;
  is_substitute: boolean;
  player: { id: string; name: string };
};

type Props = {
  matchId: string;
  teamId: string;
  teamName: string;
  roster: RosterPlayer[];
  initialLineup: LineupEntry[];
  canEdit: boolean;
};

export function MatchLineupEditor({
  matchId,
  teamId,
  teamName,
  roster,
  initialLineup,
  canEdit,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialLineup.map((e) => e.player_id)),
  );
  const [subs, setSubs] = useState<Set<string>>(
    () =>
      new Set(
        initialLineup.filter((e) => e.is_substitute).map((e) => e.player_id),
      ),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function togglePlayer(playerId: string) {
    if (!canEdit) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
        setSubs((s) => {
          const ns = new Set(s);
          ns.delete(playerId);
          return ns;
        });
      } else {
        next.add(playerId);
      }
      return next;
    });
  }

  function toggleSubstitute(playerId: string) {
    if (!canEdit || !selected.has(playerId)) return;
    setSubs((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const players = [...selected].map((player_id) => ({
        player_id,
        is_substitute: subs.has(player_id),
      }));
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

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{teamName}</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Select at least 4 players. Mark substitutes as needed.
      </p>
      <ul className="mt-3 space-y-2">
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
            {selected.has(p.id) ? (
              <label className="flex items-center gap-1 text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={subs.has(p.id)}
                  disabled={!canEdit}
                  onChange={() => toggleSubstitute(p.id)}
                  className="h-3 w-3 rounded border-zinc-300"
                />
                Sub
              </label>
            ) : null}
          </li>
        ))}
      </ul>
      {roster.length === 0 ? (
        <p className="mt-2 text-xs text-amber-700">No roster players found.</p>
      ) : null}
      {canEdit ? (
        <button
          type="button"
          onClick={save}
          disabled={saving || selected.size < 4}
          className="mt-4 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : `Save lineup (${selected.size})`}
        </button>
      ) : null}
      {selected.size > 0 && selected.size < 4 ? (
        <p className="mt-2 text-xs text-amber-700">Need at least 4 players.</p>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
