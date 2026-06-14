"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { sortDivisionsByCanonicalName } from "@/lib/competition/sort-divisions";
import { RegionalGroupScheduleSettings } from "./RegionalGroupScheduleSettings";
import { TeamsSetupPanel } from "./TeamsSetupPanel";

type Group = {
  id: string;
  name: string;
  round_count: number;
  round_robin_count: number;
};
type Division = { id: string; name: string; groups: Group[] };
type League = {
  id: string;
  name: string;
  divisions: Division[];
};

type GroupOption = {
  groupId: string;
  divisionName: string;
  groupName: string;
  roundCount: number;
  roundRobinCount: number;
};

type Props = {
  regionId: string;
  leagues: League[];
  scheduleSettingsLocked?: boolean;
  onStructureChanged: () => void;
  onTeamsChanged: () => void;
};

export function RegionalTeamsSetup({
  regionId,
  leagues,
  scheduleSettingsLocked = false,
  onStructureChanged,
  onTeamsChanged,
}: Props) {
  const t = useTranslations("admin.regionalTeams");

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [teamCount, setTeamCount] = useState(0);
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);

  const league = leagues[0] ?? null;

  const groupOptions = useMemo((): GroupOption[] => {
    if (!league) return [];
    const options: GroupOption[] = [];
    for (const division of sortDivisionsByCanonicalName(league.divisions)) {
      for (const group of division.groups) {
        options.push({
          groupId: group.id,
          divisionName: division.name,
          groupName: group.name,
          roundCount: group.round_count ?? 14,
          roundRobinCount: group.round_robin_count ?? 2,
        });
      }
    }
    return options;
  }, [league]);

  const selectedGroup = groupOptions.find((g) => g.groupId === selectedGroupId);

  useEffect(() => {
    if (groupOptions.length === 0) {
      setSelectedGroupId(null);
      return;
    }
    if (
      !selectedGroupId ||
      !groupOptions.some((g) => g.groupId === selectedGroupId)
    ) {
      setSelectedGroupId(groupOptions[0].groupId);
    }
  }, [groupOptions, selectedGroupId]);

  useEffect(() => {
    fetch(`/api/admin/competition/clubs?regionId=${regionId}`)
      .then((r) => r.json())
      .then((b) => setClubs(b.clubs ?? []));
  }, [regionId]);

  const refreshTeamCount = useCallback(async (groupId: string) => {
    const res = await fetch(`/api/admin/competition/teams?groupId=${groupId}`);
    const body = await res.json();
    setTeamCount((body.teams ?? []).length);
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      void refreshTeamCount(selectedGroupId);
    }
  }, [selectedGroupId, refreshTeamCount]);

  function handleTeamsChanged() {
    if (selectedGroupId) {
      void refreshTeamCount(selectedGroupId);
    }
    onTeamsChanged();
  }

  if (!league) {
    return (
      <section className="card">
        <p className="text-sm text-amber-800">{t("noLeagueYet")}</p>
      </section>
    );
  }

  if (groupOptions.length === 0) {
    return (
      <section className="card">
        <p className="text-sm text-zinc-600">{t("noGroups")}</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">{t("title")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">{t("group")}</span>
          <select
            value={selectedGroupId ?? ""}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="input max-w-md"
          >
            {groupOptions.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.divisionName} — {g.groupName}
              </option>
            ))}
          </select>
        </label>
      </section>

      {selectedGroup && (
        <section className="card flex flex-col gap-4">
          <RegionalGroupScheduleSettings
            groupId={selectedGroup.groupId}
            teamCount={teamCount}
            roundRobinCount={selectedGroup.roundRobinCount}
            roundCount={selectedGroup.roundCount}
            readOnly={scheduleSettingsLocked}
            onUpdated={() => {
              onStructureChanged();
              onTeamsChanged();
            }}
          />
          <TeamsSetupPanel
            groupId={selectedGroup.groupId}
            divisionLabel={`${selectedGroup.divisionName} — ${selectedGroup.groupName}`}
            clubs={clubs}
            onTeamsChanged={handleTeamsChanged}
          />
        </section>
      )}
    </div>
  );
}
