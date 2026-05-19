"use client";

import { useCallback, useEffect, useState } from "react";
import type { DivisionReadiness } from "@/lib/competition/national-readiness";
import { MatchLogViewer } from "./MatchLogViewer";
import { PenaltyManagement } from "./PenaltyManagement";
import { RulingManagement } from "./RulingManagement";
import { WarningManagement } from "./WarningManagement";

type Props = {
  divisions: DivisionReadiness[];
};

export function NationalDisciplineSection({ divisions }: Props) {
  const withGroups = divisions.filter((d) => d.groupId);
  const [groupId, setGroupId] = useState<string | null>(
    withGroups[0]?.groupId ?? null,
  );
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);

  const loadTeams = useCallback(async (gid: string) => {
    const res = await fetch(`/api/admin/competition/teams?groupId=${gid}`);
    const body = await res.json();
    if (res.ok) {
      setTeams(
        (body.teams ?? []).map((t: { id: string; name: string }) => ({
          id: t.id,
          name: t.name,
        })),
      );
    }
  }, []);

  useEffect(() => {
    if (groupId) void loadTeams(groupId);
    else setTeams([]);
  }, [groupId, loadTeams]);

  if (withGroups.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        Add teams to national divisions before managing penalties, warnings, and
        rulings.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="block text-sm font-medium text-zinc-700">
        Division / group
        <select
          value={groupId ?? ""}
          onChange={(e) => setGroupId(e.target.value || null)}
          className="mt-1 w-full max-w-md rounded-md border border-zinc-300 px-2 py-2 text-sm"
        >
          {withGroups.map((d) => (
            <option key={d.groupId!} value={d.groupId!}>
              {d.name} ({d.teamCount} teams)
            </option>
          ))}
        </select>
      </label>

      <PenaltyManagement groupId={groupId} teams={teams} />
      <WarningManagement groupId={groupId} teams={teams} />
      <RulingManagement groupId={groupId} />
      <MatchLogViewer groupId={groupId} />
    </div>
  );
}
