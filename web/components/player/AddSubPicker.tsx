"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
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
  const t = useTranslations("match.addSub");
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

  const options = useMemo(
    () =>
      available.map((player) => {
        const label = `${player.name}${
          player.member_number ? ` (${player.member_number})` : ""
        }`;
        const searchText = [player.name, player.member_number]
          .filter(Boolean)
          .join(" ");
        return { value: player.id, label, searchText };
      }),
    [available],
  );

  function handleSelect(playerId: string) {
    const player = available.find((p) => p.id === playerId);
    if (!player) return;
    onSelect(player);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
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
            <div className="mt-3">
              <SearchableSelect
                options={options}
                value=""
                onChange={handleSelect}
                placeholder={t("searchPlayer")}
                emptyMessage={t("noPlayerMatches")}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
