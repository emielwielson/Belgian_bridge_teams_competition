"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClubSubCandidate } from "@/lib/competition/player-matches";

type Props = {
  matchId: string;
  teamId: string;
  excludePlayerIds: string[];
  onSelect: (player: ClubSubCandidate) => void;
  onClose: () => void;
};

function matchesQuery(player: ClubSubCandidate, query: string): boolean {
  const haystack = [player.name, player.member_number]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

export function AddSubPicker({
  matchId,
  teamId,
  excludePlayerIds,
  onSelect,
  onClose,
}: Props) {
  const t = useTranslations("match.addSub");
  const [candidates, setCandidates] = useState<ClubSubCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/matches/${matchId}/sub-candidates?team_id=${encodeURIComponent(teamId)}`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("loadFailed"));
      setCandidates(body.players ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [matchId, teamId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const exclude = useMemo(
    () => new Set(excludePlayerIds),
    [excludePlayerIds],
  );
  const available = useMemo(
    () => candidates.filter((p) => !exclude.has(p.id)),
    [candidates, exclude],
  );
  const filtered = useMemo(
    () =>
      query.trim()
        ? available.filter((p) => matchesQuery(p, query))
        : available,
    [available, query],
  );

  function handleSelect(player: ClubSubCandidate) {
    onSelect(player);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pb-4 pt-16"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-lg"
        role="dialog"
        aria-labelledby="add-sub-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h4 id="add-sub-title" className="text-sm font-semibold text-zinc-900">
            {t("title")}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            {t("cancel")}
          </button>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-zinc-500">{t("hint")}</p>
          {loading ? (
            <p className="mt-3 text-sm text-zinc-600">{t("loading")}</p>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          ) : null}
          {!loading && !error && available.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">{t("noneAvailable")}</p>
          ) : null}
          {!loading && !error && available.length > 0 ? (
            <>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlayer")}
                className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2"
                autoComplete="off"
                autoFocus
              />
              <ul
                role="listbox"
                className="mt-2 max-h-[min(50dvh,20rem)] overflow-y-auto rounded-lg border border-zinc-200 py-1"
              >
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-zinc-500">
                    {t("noPlayerMatches")}
                  </li>
                ) : (
                  filtered.map((player) => {
                    const label = `${player.name}${
                      player.member_number
                        ? ` (${player.member_number})`
                        : ""
                    }`;
                    return (
                      <li key={player.id} role="option">
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                          onClick={() => handleSelect(player)}
                        >
                          {label}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
