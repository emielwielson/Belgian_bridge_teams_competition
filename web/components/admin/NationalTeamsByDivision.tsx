"use client";

import { useCallback, useEffect, useState } from "react";
import { NATIONAL_DIVISIONS } from "@/lib/competition/national-structure";
import { NATIONAL_TEAMS_PER_GROUP } from "@/lib/competition/national-teams";
import type { DivisionReadiness } from "@/lib/competition/national-readiness";

type Team = { id: string; name: string; club_id: string; roster: unknown[] };
type Club = { id: string; name: string };

type Props = {
  divisions: DivisionReadiness[];
  readOnly?: boolean;
  onTeamsChanged?: () => void;
};

export function NationalTeamsByDivision({
  divisions,
  readOnly = false,
  onTeamsChanged,
}: Props) {
  const [selectedDivision, setSelectedDivision] = useState(
    NATIONAL_DIVISIONS[0]?.name ?? "",
  );
  const [teams, setTeams] = useState<Team[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const division = divisions.find((d) => d.name === selectedDivision);
  const groupId = division?.groupId ?? null;

  const loadTeams = useCallback(async () => {
    if (!groupId) {
      setTeams([]);
      return;
    }
    const res = await fetch(`/api/admin/competition/teams?groupId=${groupId}`);
    if (!res.ok) return;
    const body = await res.json();
    setTeams(body.teams ?? []);
  }, [groupId]);

  useEffect(() => {
    fetch("/api/admin/competition/clubs")
      .then((r) => r.json())
      .then((b) => {
        const list = b.clubs ?? [];
        setClubs(list);
        if (list[0] && !clubId) setClubId(list[0].id);
      });
  }, [clubId]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    const club = clubs.find((c) => c.id === clubId);
    if (club && selectedDivision) {
      setTeamName(`${club.name} — ${selectedDivision}`);
    }
  }, [clubId, clubs, selectedDivision]);

  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId || readOnly) return;
    setMessage(null);
    setLoading(true);
    const res = await fetch("/api/admin/competition/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_id: groupId,
        club_id: clubId,
        name: teamName.trim(),
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
    if (readOnly || !confirm("Remove this team from the division?")) return;
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
    await loadTeams();
    onTeamsChanged?.();
  }

  const atCapacity = teams.length >= NATIONAL_TEAMS_PER_GROUP;

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">2. Teams</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Select a division, then add up to {NATIONAL_TEAMS_PER_GROUP} teams (one
          per club).
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">Division</span>
        <select
          value={selectedDivision}
          onChange={(e) => setSelectedDivision(e.target.value)}
          className="input max-w-md"
        >
          {NATIONAL_DIVISIONS.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      {!groupId && (
        <p className="text-sm text-amber-800">
          This division has no group yet. National structure may still be setting
          up.
        </p>
      )}

      {groupId && (
        <>
          <p
            className={`text-sm font-medium ${teams.length === NATIONAL_TEAMS_PER_GROUP ? "text-green-700" : "text-zinc-700"}`}
          >
            {teams.length}/{NATIONAL_TEAMS_PER_GROUP} teams in {selectedDivision}
          </p>

          <ul className="space-y-2">
            {teams.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-100 px-3 py-2 text-sm"
              >
                <span className="text-zinc-900">{t.name}</span>
                {!readOnly && (
                  <button
                    type="button"
                    className="text-xs font-medium text-red-700 underline"
                    onClick={() => removeTeam(t.id)}
                  >
                    Remove
                  </button>
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
                    <span className="text-sm font-medium text-zinc-700">
                      Team name
                    </span>
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
                    disabled={loading || atCapacity || !teamName.trim()}
                    className="btn-secondary w-fit"
                  >
                    {atCapacity ? "Division full (8 teams)" : "Add team"}
                  </button>
                </>
              )}
            </form>
          )}
        </>
      )}

      {message && (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
