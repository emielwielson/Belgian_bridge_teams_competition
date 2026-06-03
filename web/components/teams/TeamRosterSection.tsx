"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { TeamRosterPlayer } from "@/lib/competition/team-queries";
import type { RosterPlayer, TeamRosterState } from "@/lib/competition/team-roster";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";

type Props = {
  teamId: string;
  captainId: string | null;
  initialRoster: TeamRosterPlayer[];
  canManageRoster: boolean;
  rosterEditable: boolean;
};

function toDisplayRoster(players: RosterPlayer[]): TeamRosterPlayer[] {
  return players.map((p) => ({
    id: p.player_id,
    name: p.name,
    member_number: p.member_number,
    matches_played: p.matches_played ?? 0,
  }));
}

export function TeamRosterSection({
  teamId,
  captainId,
  initialRoster,
  canManageRoster,
  rosterEditable,
}: Props) {
  const t = useTranslations("team");
  const tc = useTranslations("common");
  const translateApiError = useTranslateApiError();
  const [roster, setRoster] = useState<TeamRosterPlayer[]>(initialRoster);
  const [availablePlayers, setAvailablePlayers] = useState<RosterPlayer[]>([]);
  const [addPlayerId, setAddPlayerId] = useState("");
  const [loading, setLoading] = useState(canManageRoster);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManageRoster) return;

    setLoading(true);
    const res = await fetch(`/api/teams/${teamId}/roster`);
    if (res.ok) {
      const body = (await res.json()) as TeamRosterState;
      setRoster(toDisplayRoster(body.roster));
      setAvailablePlayers(body.available_players);
      setMessage(null);
    } else {
      const err = (await res.json()) as { error?: string };
      setMessage(translateApiError(err.error ?? t("rosterLoadFailed")));
    }
    setLoading(false);
  }, [canManageRoster, teamId, t, translateApiError]);

  useEffect(() => {
    if (canManageRoster) {
      void load();
    }
  }, [canManageRoster, load]);

  async function addToRoster(playerId: string) {
    const res = await fetch(`/api/teams/${teamId}/roster`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: playerId }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      setMessage(translateApiError(err.error ?? t("addPlayerFailed")));
      return;
    }
    setAddPlayerId("");
    await load();
  }

  async function removeFromRoster(playerId: string) {
    const res = await fetch(`/api/teams/${teamId}/roster`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "roster_remove", player_id: playerId }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      setMessage(translateApiError(err.error ?? t("removePlayerFailed")));
      return;
    }
    await load();
  }

  const showEditor = canManageRoster && rosterEditable;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">{t("playersTitle")}</h2>

      {canManageRoster && !rosterEditable ? (
        <p className="mt-2 text-sm text-zinc-600">{t("rosterLocked")}</p>
      ) : null}

      {showEditor ? (
        <p className="mt-2 text-sm text-zinc-600">{t("rosterEditable")}</p>
      ) : null}

      {message ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {message}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-2 text-sm text-zinc-600">{tc("loading")}</p>
      ) : roster.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">{t("noPlayers")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {roster.map((player) => (
            <li
              key={player.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-zinc-100 px-3 py-2 text-sm"
            >
              <span className="font-medium text-zinc-900">
                {player.name}
                <span className="ml-2 font-normal text-zinc-500">
                  {t("matchesPlayed", { count: player.matches_played })}
                </span>
                {player.id === captainId ? (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    {t("captainBadge")}
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-3">
                {player.member_number ? (
                  <span className="text-zinc-600 tabular-nums">
                    {player.member_number}
                  </span>
                ) : null}
                {showEditor ? (
                  <button
                    type="button"
                    onClick={() => removeFromRoster(player.id)}
                    className="text-xs text-amber-700 hover:underline"
                  >
                    {t("remove")}
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {showEditor && !loading ? (
        <div className="mt-4 flex flex-col gap-4 border-t border-zinc-100 pt-4">
          <h3 className="text-sm font-medium text-zinc-900">{t("addFromClub")}</h3>
          {availablePlayers.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
                <span className="sr-only">{tc("team")}</span>
                <select
                  value={addPlayerId}
                  onChange={(e) => setAddPlayerId(e.target.value)}
                  className="rounded-lg border border-zinc-300 px-3 py-2"
                >
                  <option value="">{t("selectPlayer")}</option>
                  {availablePlayers.map((player) => (
                    <option key={player.player_id} value={player.player_id}>
                      {player.name}
                      {player.member_number ? ` (${player.member_number})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => addPlayerId && addToRoster(addPlayerId)}
                disabled={!addPlayerId}
                className="btn-secondary"
              >
                {t("addToTeam")}
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">{t("noUnassigned")}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
