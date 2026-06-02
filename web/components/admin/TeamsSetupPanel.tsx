"use client";

import { useCallback, useEffect, useState } from "react";

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

export function TeamsSetupPanel({
  groupId,
  divisionLabel,
  clubs,
  readOnly = false,
  maxTeams,
  onTeamsChanged,
}: Props) {
  const [teams, setTeams] = useState<TeamRow[]>([]);
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

  const atCapacity =
    maxTeams !== undefined && teams.length >= maxTeams;

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

  async function loadEditMembers(forClubId: string) {
    const res = await fetch(`/api/admin/competition/clubs/${forClubId}/players`);
    const body = await res.json();
    setEditMembers((body.players ?? []) as ClubMember[]);
  }

  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly || atCapacity) return;
    if (!captainId) {
      setMessage("Select a captain");
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
      setMessage(body.error ?? "Failed to add team");
      return;
    }
    await loadTeams();
    onTeamsChanged?.();
  }

  async function removeTeam(teamId: string) {
    if (readOnly || !confirm("Remove this team?")) return;
    setMessage(null);
    const res = await fetch("/api/admin/competition/teams", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: teamId }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Failed to remove team");
      return;
    }
    setEditingCaptainTeamId(null);
    await loadTeams();
    onTeamsChanged?.();
  }

  async function saveCaptain(team: TeamRow) {
    if (!editCaptainId) {
      setMessage("Select a captain");
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
      setMessage(body.error ?? "Failed to update captain");
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

  const clubName = (id: string) => clubs.find((c) => c.id === id)?.name ?? "Club";

  return (
    <div className="flex flex-col gap-4">
      {maxTeams !== undefined && (
        <p
          className={`text-sm font-medium ${teams.length === maxTeams ? "text-green-700" : "text-zinc-700"}`}
        >
          {teams.length}/{maxTeams} teams
        </p>
      )}

      <ul className="space-y-2">
        {teams.map((t) => (
          <li
            key={t.id}
            className="flex flex-col gap-2 rounded border border-zinc-100 px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-zinc-900">
                <span className="font-medium">{t.name}</span>
                <span className="text-zinc-500"> · {clubName(t.club_id)}</span>
                {t.captain ? (
                  <span className="text-zinc-600">
                    {" "}
                    · Captain: {t.captain.name}
                  </span>
                ) : (
                  <span className="text-amber-700"> · No captain</span>
                )}
              </span>
              {!readOnly && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-zinc-700 underline"
                    onClick={() => startEditCaptain(t)}
                  >
                    Change captain
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-red-700 underline"
                    onClick={() => removeTeam(t.id)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            {editingCaptainTeamId === t.id && !readOnly && (
              <div className="flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-600">Captain</span>
                  <select
                    value={editCaptainId}
                    onChange={(e) => setEditCaptainId(e.target.value)}
                    className="input max-w-xs text-sm"
                  >
                    <option value="">Select…</option>
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
                  onClick={() => saveCaptain(t)}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="text-xs text-zinc-600 underline"
                  onClick={() => setEditingCaptainTeamId(null)}
                >
                  Cancel
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {!readOnly && (
        <form onSubmit={addTeam} className="flex flex-col gap-3 border-t pt-4">
          {clubs.length === 0 ? (
            <p className="text-sm text-amber-800">
              No clubs found. Create clubs before adding teams.
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">Club</span>
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
                <span className="text-sm font-medium text-zinc-700">Captain</span>
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
                        ? "Loading…"
                        : "No players in this club"}
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
                  <p className="text-xs text-amber-800">
                    Add players to this club before creating a team.
                  </p>
                ) : null}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-700">Team name</span>
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
                  ? `Division full (${maxTeams} teams)`
                  : "Add team"}
              </button>
            </>
          )}
        </form>
      )}

      {message && (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
