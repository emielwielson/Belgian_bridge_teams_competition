"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type Captain = { id: string; name: string; member_number: string | null };

type Club = { id: string; name: string };

type TeamRow = {
  id: string;
  name: string;
  club_id: string;
  captain_id: string | null;
  captain: Captain | null;
  club: Club | null;
};

type ClubMember = { id: string; name: string; member_number: string | null };

type Props = {
  groupId: string | null;
};

export function TeamCaptainsPanel({ groupId }: Props) {
  const t = useTranslations("admin.teamsPanel");
  const tPage = useTranslations("admin.teamCaptainsPage");

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCaptainTeamId, setEditingCaptainTeamId] = useState<string | null>(
    null,
  );
  const [editCaptainId, setEditCaptainId] = useState("");
  const [editMembers, setEditMembers] = useState<ClubMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const captainOptions = useMemo(
    () =>
      editMembers.map((player) => {
        const label = `${player.name}${
          player.member_number ? ` (${player.member_number})` : ""
        }`;
        const searchText = [player.name, player.member_number]
          .filter(Boolean)
          .join(" ");
        return { value: player.id, label, searchText };
      }),
    [editMembers],
  );

  const loadTeams = useCallback(async () => {
    if (!groupId) {
      setTeams([]);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/admin/competition/teams?groupId=${groupId}`);
    if (res.ok) {
      const body = await res.json();
      setTeams(body.teams ?? []);
    } else {
      setTeams([]);
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    void loadTeams();
    setEditingCaptainTeamId(null);
    setMessage(null);
  }, [loadTeams]);

  async function loadEditMembers(forClubId: string) {
    setMembersLoading(true);
    const res = await fetch(`/api/admin/competition/clubs/${forClubId}/players`);
    const body = await res.json();
    setEditMembers((body.players ?? []) as ClubMember[]);
    setMembersLoading(false);
  }

  function startEditCaptain(team: TeamRow) {
    setEditingCaptainTeamId(team.id);
    setEditCaptainId(team.captain_id ?? "");
    void loadEditMembers(team.club_id);
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
  }

  if (!groupId) return null;

  if (loading) {
    return <p className="text-sm text-zinc-600">{tPage("loadingTeams")}</p>;
  }

  if (teams.length === 0) {
    return <p className="text-sm text-zinc-600">{tPage("noTeams")}</p>;
  }

  return (
    <div className="card flex flex-col gap-4">
      <ul className="space-y-2">
        {teams.map((team) => (
          <li
            key={team.id}
            className="flex flex-col gap-2 rounded border border-zinc-100 px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-zinc-900">
                <span className="font-medium">{team.name}</span>
                {team.club ? (
                  <span className="text-zinc-500"> · {team.club.name}</span>
                ) : null}
                {team.captain ? (
                  <span className="text-zinc-600">
                    {" "}
                    · {t("captain")}: {team.captain.name}
                  </span>
                ) : (
                  <span className="text-amber-700">{t("noCaptain")}</span>
                )}
              </span>
              <button
                type="button"
                className="text-xs font-medium text-zinc-700 underline"
                onClick={() => startEditCaptain(team)}
              >
                {t("changeCaptain")}
              </button>
            </div>
            {editingCaptainTeamId === team.id && (
              <div className="flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-2">
                <label className="flex min-w-[16rem] max-w-xs flex-1 flex-col gap-1">
                  <span className="text-xs text-zinc-600">{t("captain")}</span>
                  <SearchableSelect
                    options={captainOptions}
                    value={editCaptainId}
                    onChange={setEditCaptainId}
                    placeholder={
                      membersLoading ? t("loadingMembers") : t("searchCaptain")
                    }
                    emptyMessage={t("noCaptainMatches")}
                    disabled={membersLoading}
                  />
                </label>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => void saveCaptain(team)}
                  disabled={membersLoading || !editCaptainId}
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
      {message ? (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
