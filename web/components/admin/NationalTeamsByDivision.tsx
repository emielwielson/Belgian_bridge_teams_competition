"use client";

import { useCallback, useEffect, useState } from "react";
import { TeamsSetupPanel } from "@/components/admin/TeamsSetupPanel";
import { NATIONAL_DIVISIONS } from "@/lib/competition/national-structure";
import { NATIONAL_TEAMS_PER_GROUP } from "@/lib/competition/national-teams";
import type { DivisionReadiness } from "@/lib/competition/national-readiness";

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
  const [clubs, setClubs] = useState<Club[]>([]);

  const division = divisions.find((d) => d.name === selectedDivision);
  const groupId = division?.groupId ?? null;

  useEffect(() => {
    fetch("/api/admin/competition/clubs")
      .then((r) => r.json())
      .then((b) => setClubs(b.clubs ?? []));
  }, []);

  const handleTeamsChanged = useCallback(() => {
    onTeamsChanged?.();
  }, [onTeamsChanged]);

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Teams</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Select a division, then add up to {NATIONAL_TEAMS_PER_GROUP} teams (one
          per club). Each team needs a captain from that club.
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
        <TeamsSetupPanel
          groupId={groupId}
          divisionLabel={selectedDivision}
          clubs={clubs}
          readOnly={readOnly}
          maxTeams={NATIONAL_TEAMS_PER_GROUP}
          onTeamsChanged={handleTeamsChanged}
        />
      )}
    </section>
  );
}
