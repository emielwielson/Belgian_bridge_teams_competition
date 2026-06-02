"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  emptyScheduleSlots,
  slotsAreComplete,
  type ScheduleSlotRow,
} from "@/lib/competition/group-schedule-slots";

type Club = { id: string; name: string };

type Captain = { id: string; name: string; member_number: string | null };

type TeamRow = {
  id: string;
  name: string;
  club_id: string;
  captain_id: string | null;
  captain: Captain | null;
};

type ClubMember = { id: string; name: string; member_number: string | null };

type Props = {
  groupId: string;
  divisionLabel: string;
  clubs: Club[];
  readOnly?: boolean;
  maxTeams?: number;
  onTeamsChanged?: () => void;
};

type DragItem =
  | { kind: "team"; id: string; name: string }
  | { kind: "bye" };

const BYE_ID = "__bye__";

function dragId(item: DragItem): string {
  return item.kind === "bye" ? BYE_ID : item.id;
}

function slotsToPayload(slots: ScheduleSlotRow[]) {
  return slots.map((s) => ({
    slot: s.slot,
    teamId: s.isBye ? null : s.teamId,
    isBye: s.isBye,
  }));
}

function DragHandle({
  item,
  disabled,
}: {
  item: DragItem;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.teamsPanel");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId(item),
    disabled,
    data: { item },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`shrink-0 cursor-grab rounded px-1.5 py-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
      aria-label={t("dragAria")}
      {...listeners}
      {...attributes}
      disabled={disabled}
    >
      ⠿
    </button>
  );
}

function PoolChip({
  item,
  disabled,
}: {
  item: DragItem;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.teamsPanel");
  const tCommon = useTranslations("common");
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: dragId(item),
      disabled,
      data: { item },
    });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={`inline-flex cursor-grab items-center rounded border px-2 py-1 text-xs font-medium active:cursor-grabbing ${
        item.kind === "bye"
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-zinc-300 bg-white text-zinc-900"
      } ${isDragging ? "opacity-40" : ""}`}
      {...listeners}
      {...attributes}
      disabled={disabled}
    >
      {item.kind === "bye" ? tCommon("bye") : item.name}
    </button>
  );
}

function PoolDropZone({
  children,
  readOnly,
}: {
  children: React.ReactNode;
  readOnly?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "pool",
    disabled: readOnly,
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded border border-dashed p-3 ${
        isOver ? "border-blue-400 bg-blue-50" : "border-zinc-300 bg-zinc-50"
      }`}
    >
      {children}
    </div>
  );
}

function SlotListItem({
  row,
  team,
  readOnly,
  onEditCaptain,
  onRemove,
  editingCaptainTeamId,
  editCaptainId,
  setEditCaptainId,
  editMembers,
  onSaveCaptain,
  onCancelEdit,
  clubName,
}: {
  row: ScheduleSlotRow;
  team?: TeamRow;
  readOnly?: boolean;
  onEditCaptain: (team: TeamRow) => void;
  onRemove: (teamId: string) => void;
  editingCaptainTeamId: string | null;
  editCaptainId: string;
  setEditCaptainId: (id: string) => void;
  editMembers: ClubMember[];
  onSaveCaptain: (team: TeamRow) => void;
  onCancelEdit: () => void;
  clubName: (id: string) => string;
}) {
  const t = useTranslations("admin.teamsPanel");
  const tCommon = useTranslations("common");
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${row.slot}`,
    disabled: readOnly,
  });

  const dragItem: DragItem | null = row.isBye
    ? { kind: "bye" }
    : team
      ? { kind: "team", id: team.id, name: team.name }
      : null;

  return (
    <li
      ref={setNodeRef}
      className={`flex flex-col gap-2 rounded border px-3 py-2 text-sm ${
        isOver ? "border-blue-400 bg-blue-50" : "border-zinc-100 bg-white"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-8 shrink-0 text-xs font-semibold text-zinc-500">
          {row.slot}
        </span>
        {!readOnly && dragItem ? (
          <DragHandle item={dragItem} />
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {row.isBye ? (
            <span className="inline-flex w-fit rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
              {tCommon("bye")}
            </span>
          ) : team ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-zinc-900">
                <span className="font-medium">{team.name}</span>
                <span className="text-zinc-500"> · {clubName(team.club_id)}</span>
                {team.captain ? (
                  <span className="text-zinc-600">
                    {" "}
                    · {t("captain")}: {team.captain.name}
                  </span>
                ) : (
                  <span className="text-amber-700">{t("noCaptain")}</span>
                )}
              </span>
              {!readOnly && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-zinc-700 underline"
                    onClick={() => onEditCaptain(team)}
                  >
                    {t("changeCaptain")}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-red-700 underline"
                    onClick={() => onRemove(team.id)}
                  >
                    {tCommon("remove")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <span className="text-zinc-400">{t("empty")}</span>
          )}
          {team && editingCaptainTeamId === team.id && !readOnly ? (
            <div className="flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-600">{t("captain")}</span>
                <select
                  value={editCaptainId}
                  onChange={(e) => setEditCaptainId(e.target.value)}
                  className="input max-w-xs text-sm"
                >
                  <option value="">{t("selectCaptain")}</option>
                  {editMembers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.member_number ? ` (${p.member_number})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => onSaveCaptain(team)}
              >
                {t("save")}
              </button>
              <button
                type="button"
                className="text-xs text-zinc-600 underline"
                onClick={onCancelEdit}
              >
                {t("cancel")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function TeamsSetupPanel({
  groupId,
  divisionLabel,
  clubs,
  readOnly = false,
  maxTeams,
  onTeamsChanged,
}: Props) {
  const t = useTranslations("admin.teamsPanel");
  const tCommon = useTranslations("common");

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [slots, setSlots] = useState<ScheduleSlotRow[]>(emptyScheduleSlots());
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [byeEnabled, setByeEnabled] = useState(false);
  const [activeItem, setActiveItem] = useState<DragItem | null>(null);
  const [slotSaving, setSlotSaving] = useState(false);
  const [clubId, setClubId] = useState("");
  const [captainId, setCaptainId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [editingCaptainTeamId, setEditingCaptainTeamId] = useState<string | null>(
    null,
  );
  const [editCaptainId, setEditCaptainId] = useState("");
  const [editMembers, setEditMembers] = useState<ClubMember[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const useSlotOrdering = teams.length >= 7 && teams.length <= 8;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const atCapacity =
    maxTeams !== undefined && teams.length >= maxTeams;

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams],
  );

  const loadTeams = useCallback(async () => {
    const res = await fetch(`/api/admin/competition/teams?groupId=${groupId}`);
    if (!res.ok) return;
    const body = await res.json();
    setTeams(body.teams ?? []);
  }, [groupId]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    if (!useSlotOrdering) return;
    let cancelled = false;

    (async () => {
      setSlotsLoading(true);
      const res = await fetch(
        `/api/admin/competition/groups/${groupId}/schedule-slots`,
      );
      if (cancelled) return;
      if (!res.ok) {
        setSlotsLoading(false);
        return;
      }
      const body = await res.json();
      if (cancelled) return;
      if (!body.applicable) {
        setSlotsLoading(false);
        return;
      }
      setSlots(body.slots ?? emptyScheduleSlots());
      setByeEnabled(
        (body.slots as ScheduleSlotRow[] | undefined)?.some((s) => s.isBye) ??
          false,
      );
      setSlotsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [useSlotOrdering, groupId, teams.length]);

  useEffect(() => {
    if (clubs[0] && !clubId) setClubId(clubs[0].id);
  }, [clubs, clubId]);

  useEffect(() => {
    const club = clubs.find((c) => c.id === clubId);
    if (club && divisionLabel) {
      setTeamName(`${club.name} — ${divisionLabel}`);
    }
  }, [clubId, clubs, divisionLabel]);

  useEffect(() => {
    if (!clubId) {
      setClubMembers([]);
      setCaptainId("");
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    fetch(`/api/admin/competition/clubs/${clubId}/players`)
      .then((r) => r.json())
      .then((b) => {
        if (cancelled) return;
        const list = (b.players ?? []) as ClubMember[];
        setClubMembers(list);
        setCaptainId((prev) =>
          list.some((p) => p.id === prev) ? prev : (list[0]?.id ?? ""),
        );
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const poolItems = useMemo(() => {
    if (!useSlotOrdering) return [];
    const assignedTeamIds = new Set(
      slots.filter((s) => s.teamId).map((s) => s.teamId as string),
    );
    const hasByeInSlot = slots.some((s) => s.isBye);
    const items: DragItem[] = teams
      .filter((t) => !assignedTeamIds.has(t.id))
      .map((t) => ({ kind: "team" as const, id: t.id, name: t.name }));
    if (!hasByeInSlot && teams.length === 7 && byeEnabled) {
      items.push({ kind: "bye" });
    }
    return items;
  }, [useSlotOrdering, slots, teams, byeEnabled]);

  const slotsComplete = useMemo(() => {
    if (!useSlotOrdering) return true;
    return slotsAreComplete(teams.length, slots);
  }, [useSlotOrdering, teams.length, slots]);

  async function persistSlots(nextSlots: ScheduleSlotRow[]) {
    setSlotSaving(true);
    const res = await fetch(
      `/api/admin/competition/groups/${groupId}/schedule-slots`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: slotsToPayload(nextSlots) }),
      },
    );
    const body = await res.json();
    setSlotSaving(false);
    if (!res.ok) {
      setMessage(body.error ?? t("saveOrderFailed"));
      return;
    }
    setSlots(body.slots ?? nextSlots);
    onTeamsChanged?.();
  }

  function parseDropTarget(overId: string | number): number | "pool" | null {
    const id = String(overId);
    if (id === "pool") return "pool";
    if (id.startsWith("slot-")) {
      const slot = Number(id.replace("slot-", ""));
      if (slot >= 1 && slot <= 8) return slot;
    }
    return null;
  }

  function findItemLocation(item: DragItem): number | "pool" {
    if (item.kind === "bye") {
      const row = slots.find((s) => s.isBye);
      return row ? row.slot : "pool";
    }
    const row = slots.find((s) => s.teamId === item.id);
    return row ? row.slot : "pool";
  }

  function itemToSlotFields(item: DragItem): Pick<ScheduleSlotRow, "teamId" | "isBye"> {
    if (item.kind === "bye") return { teamId: null, isBye: true };
    return { teamId: item.id, isBye: false };
  }

  function clearSlot(slot: number): ScheduleSlotRow[] {
    return slots.map((s) =>
      s.slot === slot ? { ...s, teamId: null, isBye: false } : s,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    if (readOnly || !event.over) return;

    const activeData = event.active.data.current?.item as DragItem | undefined;
    if (!activeData) return;

    const target = parseDropTarget(event.over.id);
    if (target === null) return;

    const source = findItemLocation(activeData);
    if (source === target) return;

    let next = [...slots];

    if (target === "pool") {
      if (source !== "pool") {
        next = clearSlot(source as number);
        if (activeData.kind === "bye") {
          setByeEnabled(true);
        }
      }
    } else {
      const targetSlot = target as number;
      const targetRow = next.find((s) => s.slot === targetSlot);
      const sourceRow =
        source !== "pool" ? next.find((s) => s.slot === source) : null;

      if (source === "pool") {
        next = next.map((s) => {
          if (s.slot === targetSlot) {
            return { ...s, ...itemToSlotFields(activeData) };
          }
          return s;
        });
        if (targetRow?.isBye) {
          setByeEnabled(true);
        }
      } else if (sourceRow) {
        const targetFields = targetRow
          ? { teamId: targetRow.teamId, isBye: targetRow.isBye }
          : { teamId: null, isBye: false };

        next = next.map((s) => {
          if (s.slot === source) {
            return { ...s, ...targetFields };
          }
          if (s.slot === targetSlot) {
            return { ...s, ...itemToSlotFields(activeData) };
          }
          return s;
        });
      }
    }

    setSlots(next);
    void persistSlots(next);
  }

  function handleDragStart(event: DragStartEvent) {
    const item = event.active.data.current?.item as DragItem | undefined;
    setActiveItem(item ?? null);
  }

  async function loadEditMembers(forClubId: string) {
    const res = await fetch(`/api/admin/competition/clubs/${forClubId}/players`);
    const body = await res.json();
    setEditMembers((body.players ?? []) as ClubMember[]);
  }

  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly || atCapacity) return;
    if (!captainId) {
      setMessage(t("selectCaptainError"));
      return;
    }
    setMessage(null);
    setLoading(true);
    const res = await fetch("/api/admin/competition/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_id: groupId,
        club_id: clubId,
        name: teamName.trim(),
        captain_id: captainId,
      }),
    });
    setLoading(false);
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? t("addTeamFailed"));
      return;
    }
    await loadTeams();
    onTeamsChanged?.();
  }

  async function removeTeam(teamId: string) {
    if (readOnly || !confirm(t("removeConfirm"))) return;
    setMessage(null);
    const res = await fetch("/api/admin/competition/teams", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: teamId }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? t("removeFailed"));
      return;
    }
    setEditingCaptainTeamId(null);
    await loadTeams();
    onTeamsChanged?.();
  }

  async function saveCaptain(team: TeamRow) {
    if (!editCaptainId) {
      setMessage(t("selectCaptainError"));
      return;
    }
    setMessage(null);
    const res = await fetch("/api/admin/competition/teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: team.id, captain_id: editCaptainId }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? t("updateCaptainFailed"));
      return;
    }
    setEditingCaptainTeamId(null);
    await loadTeams();
    onTeamsChanged?.();
  }

  function startEditCaptain(team: TeamRow) {
    setEditingCaptainTeamId(team.id);
    setEditCaptainId(team.captain_id ?? "");
    void loadEditMembers(team.club_id);
  }

  const clubName = (id: string) =>
    clubs.find((c) => c.id === id)?.name ?? t("clubFallback");

  return (
    <div className="flex flex-col gap-4">
      {maxTeams !== undefined && (
        <p
          className={`text-sm font-medium ${teams.length === maxTeams ? "text-green-700" : "text-zinc-700"}`}
        >
          {t("teamsProgress", { current: teams.length, max: maxTeams })}
        </p>
      )}

      {useSlotOrdering && (
        <p className="text-xs text-zinc-600">
          {t("dragHint")}
          {teams.length === 7 ? t("dragHintBye") : null}
        </p>
      )}

      {useSlotOrdering && slotsLoading ? (
        <p className="text-sm text-zinc-600">{t("loadingOrder")}</p>
      ) : useSlotOrdering ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <ul className="space-y-2">
            {slots.map((row) => (
              <SlotListItem
                key={row.slot}
                row={row}
                team={row.teamId ? teamById.get(row.teamId) : undefined}
                readOnly={readOnly}
                onEditCaptain={startEditCaptain}
                onRemove={removeTeam}
                editingCaptainTeamId={editingCaptainTeamId}
                editCaptainId={editCaptainId}
                setEditCaptainId={setEditCaptainId}
                editMembers={editMembers}
                onSaveCaptain={saveCaptain}
                onCancelEdit={() => setEditingCaptainTeamId(null)}
                clubName={clubName}
              />
            ))}
          </ul>

          {!readOnly && poolItems.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-700">
                {t("unassigned")}
              </p>
              <PoolDropZone readOnly={readOnly}>
                <div className="flex flex-wrap gap-2">
                  {poolItems.map((item) => (
                    <PoolChip key={dragId(item)} item={item} />
                  ))}
                </div>
              </PoolDropZone>
            </div>
          )}

          {!readOnly &&
            teams.length === 7 &&
            !byeEnabled &&
            !slots.some((s) => s.isBye) && (
              <button
                type="button"
                className="btn-secondary w-fit text-xs"
                onClick={() => setByeEnabled(true)}
              >
                {t("addBye")}
              </button>
            )}

          <DragOverlay>
            {activeItem ? (
              activeItem.kind === "bye" ? (
                <PoolChip item={activeItem} />
              ) : (
                <span className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium shadow">
                  {activeItem.name}
                </span>
              )
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <ul className="space-y-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex flex-col gap-2 rounded border border-zinc-100 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-zinc-900">
                  <span className="font-medium">{team.name}</span>
                  <span className="text-zinc-500"> · {clubName(team.club_id)}</span>
                  {team.captain ? (
                    <span className="text-zinc-600">
                      {" "}
                      · {t("captain")}: {team.captain.name}
                    </span>
                  ) : (
                    <span className="text-amber-700">{t("noCaptain")}</span>
                  )}
                </span>
                {!readOnly && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-zinc-700 underline"
                      onClick={() => startEditCaptain(team)}
                    >
                      {t("changeCaptain")}
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-red-700 underline"
                      onClick={() => removeTeam(team.id)}
                    >
                      {tCommon("remove")}
                    </button>
                  </div>
                )}
              </div>
              {editingCaptainTeamId === team.id && !readOnly && (
                <div className="flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-600">{t("captain")}</span>
                    <select
                      value={editCaptainId}
                      onChange={(e) => setEditCaptainId(e.target.value)}
                      className="input max-w-xs text-sm"
                    >
                      <option value="">{t("selectCaptain")}</option>
                      {editMembers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.member_number ? ` (${p.member_number})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => saveCaptain(team)}
                  >
                    {t("save")}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-zinc-600 underline"
                    onClick={() => setEditingCaptainTeamId(null)}
                  >
                    {t("cancel")}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && useSlotOrdering && !slotsComplete && (
        <p className="text-xs text-amber-800">
          {t("assignSlotsWarning", {
            byePart: teams.length === 7 ? t("byePart") : "",
          })}
        </p>
      )}

      {!readOnly && (
        <form onSubmit={addTeam} className="flex flex-col gap-3 border-t pt-4">
          {clubs.length === 0 ? (
            <p className="text-sm text-amber-800">{t("noClubs")}</p>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">{t("club")}</span>
                <select
                  value={clubId}
                  onChange={(e) => setClubId(e.target.value)}
                  className="input max-w-md"
                  required
                >
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">{t("captain")}</span>
                <select
                  value={captainId}
                  onChange={(e) => setCaptainId(e.target.value)}
                  className="input max-w-md"
                  required
                  disabled={membersLoading || clubMembers.length === 0}
                >
                  {clubMembers.length === 0 ? (
                    <option value="">
                      {membersLoading
                        ? t("loadingMembers")
                        : t("noPlayersInClub")}
                    </option>
                  ) : (
                    clubMembers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.member_number ? ` (${p.member_number})` : ""}
                      </option>
                    ))
                  )}
                </select>
                {!membersLoading && clubMembers.length === 0 && clubId ? (
                  <p className="text-xs text-amber-800">{t("addPlayersFirst")}</p>
                ) : null}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">{t("teamName")}</span>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="input max-w-md"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={
                  loading ||
                  atCapacity ||
                  !teamName.trim() ||
                  !captainId ||
                  clubMembers.length === 0
                }
                className="btn-secondary w-fit"
              >
                {atCapacity && maxTeams !== undefined
                  ? t("divisionFull", { max: maxTeams })
                  : t("addTeam")}
              </button>
            </>
          )}
        </form>
      )}

      {(message || slotSaving) && (
        <p className="text-sm text-zinc-700" role="status">
          {slotSaving ? t("savingOrder") : message}
        </p>
      )}
    </div>
  );
}
