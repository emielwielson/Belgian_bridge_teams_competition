"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClubSubCandidate } from "@/lib/competition/player-matches";

type Props = {
  matchId: string;
  teamId: string;
  excludePlayerIds: string[];
  onSelect: (player: ClubSubCandidate) => void;
  onClose: () => void;
};

export function AddSubPicker({
  matchId,
  teamId,
  excludePlayerIds,
  onSelect,
  onClose,
}: Props) {
  const [candidates, setCandidates] = useState<ClubSubCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/matches/${matchId}/sub-candidates?team_id=${encodeURIComponent(teamId)}`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load club players");
      setCandidates(body.players ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load club players");
    } finally {
      setLoading(false);
    }
  }, [matchId, teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const exclude = new Set(excludePlayerIds);
  const available = candidates.filter((p) => !exclude.has(p.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-lg bg-white shadow-lg"
        role="dialog"
        aria-labelledby="add-sub-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h4 id="add-sub-title" className="text-sm font-semibold text-zinc-900">
            Add substitute
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            Cancel
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
          <p className="text-xs text-zinc-500">
            Choose a club member who is not on the team roster.
          </p>
          {loading ? (
            <p className="mt-3 text-sm text-zinc-600">Loading…</p>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          ) : null}
          {!loading && !error && available.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">
              No eligible club players available.
            </p>
          ) : null}
          {!loading && !error && available.length > 0 ? (
            <ul className="mt-3 divide-y divide-zinc-100">
              {available.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full px-1 py-2.5 text-left text-sm hover:bg-zinc-50"
                    onClick={() => {
                      onSelect(p);
                      onClose();
                    }}
                  >
                    {p.name}
                    {p.member_number ? (
                      <span className="ml-1 text-zinc-400">
                        ({p.member_number})
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
