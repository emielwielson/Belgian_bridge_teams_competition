"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AddSubPicker } from "@/components/player/AddSubPicker";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import type { ClubSubCandidate } from "@/lib/competition/player-matches";
import {
  honorSeatSlots,
  seatKey,
  type HonorDirection,
  type HonorLineupPhase,
  type HonorRoom,
  type HonorSeatSlot,
  type HonorSide,
  type HonorVenueTables,
} from "@/lib/competition/honor-lineup";

type RosterPlayer = {
  id: string;
  name: string;
  member_number: string | null;
};

type LineupEntry = {
  player_id: string;
  is_substitute: boolean;
  room: HonorRoom | null;
  direction: HonorDirection | null;
  player: { id: string; name: string; member_number?: string | null };
};

type SeatAssignment = Record<string, string | null>;

type Props = {
  matchId: string;
  side: HonorSide;
  teamId: string;
  teamName: string;
  opponentTeamName: string;
  roster: RosterPlayer[];
  initialLineup: LineupEntry[];
  canEdit: boolean;
  canLock: boolean;
  canUnlock: boolean;
  canViewSeats: boolean;
  locked: boolean;
  opponentLocked: boolean;
  phase: HonorLineupPhase;
  venueTables: HonorVenueTables | null;
};

function initialSeats(lineup: LineupEntry[], side: HonorSide): SeatAssignment {
  const seats: SeatAssignment = {};
  for (const slot of honorSeatSlots(side)) {
    seats[seatKey(slot)] = null;
  }
  for (const row of lineup) {
    if (row.room && row.direction) {
      seats[seatKey({ room: row.room, direction: row.direction })] =
        row.player_id;
    }
  }
  return seats;
}

function slotLabel(
  slot: HonorSeatSlot,
  venueTables: HonorVenueTables | null,
  t: ReturnType<typeof useTranslations>,
): string {
  const roomLabel =
    slot.room === "open" ? t("roomOpen") : t("roomClosed");
  const table =
    venueTables == null
      ? null
      : slot.room === "open"
        ? venueTables.openTable
        : venueTables.closedTable;
  const compass = slot.direction;
  if (table != null) {
    return t("seatWithTable", {
      room: roomLabel,
      table,
      direction: compass,
    });
  }
  return t("seat", { room: roomLabel, direction: compass });
}

function playerLabel(
  player: RosterPlayer,
  isSubstitute: boolean,
  t: ReturnType<typeof useTranslations>,
): string {
  const base = player.member_number
    ? `${player.name} (${player.member_number})`
    : player.name;
  return isSubstitute ? t("playerWithSubBadge", { name: base }) : base;
}

export function HonorMatchLineupEditor({
  matchId,
  side,
  teamId,
  teamName,
  opponentTeamName,
  roster,
  initialLineup,
  canEdit,
  canLock,
  canUnlock,
  canViewSeats,
  locked,
  opponentLocked,
  phase,
  venueTables,
}: Props) {
  const t = useTranslations("match.honorLineup");
  const tLineup = useTranslations("match.lineup");
  const router = useRouter();
  const [seats, setSeats] = useState<SeatAssignment>(() =>
    initialSeats(initialLineup, side),
  );
  const [extraPlayers, setExtraPlayers] = useState<RosterPlayer[]>(() =>
    initialLineup
      .filter((e) => e.is_substitute)
      .map((e) => ({
        id: e.player_id,
        name: e.player.name,
        member_number: e.player.member_number ?? null,
      })),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmLockOpen, setConfirmLockOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slots = honorSeatSlots(side);
  const filledCount = slots.filter((s) => seats[seatKey(s)]).length;
  const seatsComplete = filledCount === slots.length;
  const rosterIds = useMemo(
    () => new Set(roster.map((p) => p.id)),
    [roster],
  );
  const waitingForAwayFirst =
    phase === "sequential" && side === "home" && !opponentLocked && !locked;
  const yourTurnToEnter = !locked && canEdit;

  const playerOptions = useMemo(() => {
    const byId = new Map<string, RosterPlayer>();
    for (const p of roster) byId.set(p.id, p);
    for (const p of extraPlayers) byId.set(p.id, p);
    return [...byId.values()].map((p) => ({
      value: p.id,
      label: playerLabel(p, !rosterIds.has(p.id), t),
    }));
  }, [roster, extraPlayers, rosterIds, t]);

  function setSeat(slot: HonorSeatSlot, playerId: string | null) {
    if (!canEdit) return;
    const key = seatKey(slot);
    setSeats((prev) => {
      const next = { ...prev };
      if (playerId) {
        for (const k of Object.keys(next)) {
          if (k !== key && next[k] === playerId) next[k] = null;
        }
      }
      next[key] = playerId;
      return next;
    });
  }

  function addSub(player: ClubSubCandidate) {
    setExtraPlayers((prev) => {
      if (prev.some((p) => p.id === player.id)) return prev;
      return [
        ...prev,
        {
          id: player.id,
          name: player.name,
          member_number: player.member_number,
        },
      ];
    });
    setMessage(t("subAdded", { name: player.name }));
  }

  function removeSub(playerId: string) {
    if (!canEdit) return;
    setExtraPlayers((prev) => prev.filter((p) => p.id !== playerId));
    setSeats((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key] === playerId) next[key] = null;
      }
      return next;
    });
  }

  function buildPlayersPayload() {
    const players: {
      player_id: string;
      is_substitute: boolean;
      room: HonorRoom;
      direction: HonorDirection;
    }[] = [];
    for (const slot of slots) {
      const playerId = seats[seatKey(slot)];
      if (!playerId) continue;
      players.push({
        player_id: playerId,
        is_substitute: !rosterIds.has(playerId),
        room: slot.room,
        direction: slot.direction,
      });
    }
    return players;
  }

  async function submitLock() {
    setLocking(true);
    setError(null);
    setMessage(null);
    try {
      const players = buildPlayersPayload();
      const saveRes = await fetch(`/api/matches/${matchId}/players`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId, players }),
      });
      const saveBody = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveBody.error ?? tLineup("saveFailed"));
      }

      const lockRes = await fetch(`/api/matches/${matchId}/players/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });
      const lockBody = await lockRes.json();
      if (!lockRes.ok) {
        throw new Error(lockBody.error ?? t("lockFailed"));
      }
      setConfirmLockOpen(false);
      setMessage(t("locked", { teamName }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("lockFailed"));
      setConfirmLockOpen(false);
    } finally {
      setLocking(false);
    }
  }

  async function unlock() {
    setLocking(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/players/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("unlockFailed"));
      setMessage(t("unlocked", { teamName }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unlockFailed"));
    } finally {
      setLocking(false);
    }
  }

  const statusTone = locked
    ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
    : waitingForAwayFirst
      ? "bg-amber-100 text-amber-950 ring-1 ring-amber-200"
      : yourTurnToEnter
        ? "bg-sky-100 text-sky-950 ring-1 ring-sky-200"
        : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";

  const statusLabel = locked
    ? t("statusLocked")
    : waitingForAwayFirst
      ? t("statusWaitingAway")
      : yourTurnToEnter
        ? t("statusYourTurn")
        : t("statusIdle");

  const guidance = locked
    ? canUnlock
      ? t("lockedDirectorCanUnlock")
      : t("lockedAskDirector")
    : waitingForAwayFirst
      ? t("waitingForAwayBody", { team: opponentTeamName })
      : yourTurnToEnter && phase === "sequential" && side === "away"
        ? t("awayGoesFirstHint")
        : yourTurnToEnter &&
            phase === "sequential" &&
            side === "home" &&
            opponentLocked
          ? t("homeMayEnterHint")
          : null;

  const excludeSubIds = [
    ...roster.map((p) => p.id),
    ...extraPlayers.map((p) => p.id),
  ];

  return (
    <section
      className={`rounded-lg border bg-white p-4 ${
        locked
          ? "border-emerald-300"
          : yourTurnToEnter
            ? "border-sky-300"
            : waitingForAwayFirst
              ? "border-amber-300"
              : "border-zinc-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{teamName}</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {side === "home" ? t("homeTeam") : t("awayTeam")}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone}`}
        >
          {statusLabel}
        </span>
      </div>

      {guidance ? (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            locked
              ? "bg-emerald-50 text-emerald-950"
              : waitingForAwayFirst
                ? "bg-amber-50 text-amber-950"
                : "bg-sky-50 text-sky-950"
          }`}
          role="status"
        >
          {guidance}
        </p>
      ) : null}

      {!canViewSeats ? (
        <p className="mt-4 text-sm text-zinc-600">{t("hiddenUntilReveal")}</p>
      ) : (
        <>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t("seatsHeading")}
          </p>
          <ul className="mt-2 space-y-3">
            {slots.map((slot) => {
              const key = seatKey(slot);
              const value = seats[key];
              return (
                <li key={key} className="text-sm">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    {slotLabel(slot, venueTables, t)}
                  </label>
                  {canEdit ? (
                    <SearchableSelect
                      options={[
                        { value: "", label: t("emptySeat") },
                        ...playerOptions,
                      ]}
                      value={value ?? ""}
                      onChange={(v) => setSeat(slot, v || null)}
                      placeholder={t("pickPlayer")}
                    />
                  ) : (
                    <p className="rounded border border-zinc-100 bg-zinc-50 px-3 py-2 text-zinc-800">
                      {value
                        ? (playerOptions.find((o) => o.value === value)?.label ??
                          value)
                        : t("emptySeat")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {canEdit || extraPlayers.length > 0 ? (
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {t("substitutesHeading")}
              </p>
              {t("substitutesHint") ? (
                <p className="mt-1 text-xs text-zinc-500">{t("substitutesHint")}</p>
              ) : null}
              {extraPlayers.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {extraPlayers.map((player) => (
                    <li
                      key={player.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm text-zinc-900"
                    >
                      <span>
                        {playerLabel(player, true, t)}
                      </span>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => removeSub(player.id)}
                          className="text-xs font-medium text-red-700 underline"
                        >
                          {tLineup("remove")}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : canEdit ? (
                <p className="mt-2 text-xs text-zinc-500">
                  {t("noSubstitutes")}
                </p>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="mt-2 text-sm font-medium text-emerald-800 hover:underline"
                >
                  {t("addSubstitute")}
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {message ? (
        <p className="mt-3 text-sm text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canEdit && canLock ? (
          <button
            type="button"
            disabled={locking || !seatsComplete}
            onClick={() => setConfirmLockOpen(true)}
            className="rounded-md bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
          >
            {locking ? t("submitting") : t("submitLineup")}
          </button>
        ) : null}
        {canUnlock && locked ? (
          <button
            type="button"
            disabled={locking}
            onClick={() => void unlock()}
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {t("unlock")}
          </button>
        ) : null}
      </div>

      {canEdit && !seatsComplete ? (
        <p className="mt-2 text-xs text-zinc-500">
          {t("needAllSeats", { filled: filledCount, total: slots.length })}
        </p>
      ) : null}

      {confirmLockOpen ? (
        <ConfirmDialog
          title={t("lockConfirmTitle")}
          message={t("lockConfirmMessage")}
          confirmLabel={t("lockConfirmAction")}
          cancelLabel={t("cancel")}
          confirming={locking}
          onConfirm={() => void submitLock()}
          onCancel={() => {
            if (!locking) setConfirmLockOpen(false);
          }}
        />
      ) : null}

      {pickerOpen ? (
        <AddSubPicker
          matchId={matchId}
          teamId={teamId}
          excludePlayerIds={excludeSubIds}
          onClose={() => setPickerOpen(false)}
          onSelect={(player) => {
            addSub(player);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
