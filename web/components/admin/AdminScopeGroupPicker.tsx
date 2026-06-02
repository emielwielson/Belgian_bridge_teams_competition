"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { DivisionReadiness } from "@/lib/competition/national-readiness";
import type { GroupReadiness } from "@/lib/competition/regional-readiness";
import { groupLabel } from "@/lib/competition/regional-readiness";
import {
  SCOPES,
  type CompetitionScope,
  type RegionCode,
} from "@/lib/competition/scopes";
import { translateDivisionName } from "@/lib/i18n/labels";

export type AdminGroupTeam = { id: string; name: string };

type Props = {
  scope: CompetitionScope;
  regionCode?: RegionCode;
  onGroupChange: (groupId: string | null, teams: AdminGroupTeam[]) => void;
};

export function AdminScopeGroupPicker({
  scope,
  regionCode,
  onGroupChange,
}: Props) {
  const t = useTranslations("admin.nationalDiscipline");
  const tDiscipline = useTranslations("admin.disciplinePage");
  const tDivisions = useTranslations("divisions");

  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [nationalOptions, setNationalOptions] = useState<DivisionReadiness[]>(
    [],
  );
  const [regionalOptions, setRegionalOptions] = useState<GroupReadiness[]>([]);

  const loadTeams = useCallback(
    async (gid: string) => {
      const res = await fetch(`/api/admin/competition/teams?groupId=${gid}`);
      const body = await res.json();
      if (res.ok) {
        const teams = (body.teams ?? []).map((row: { id: string; name: string }) => ({
          id: row.id,
          name: row.name,
        }));
        onGroupChange(gid, teams);
      } else {
        onGroupChange(gid, []);
      }
    },
    [onGroupChange],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      if (scope === SCOPES.NATIONAL) {
        const res = await fetch("/api/admin/competition/national/readiness");
        if (cancelled) return;
        if (!res.ok) {
          setNationalOptions([]);
          setLoading(false);
          onGroupChange(null, []);
          return;
        }
        const body = await res.json();
        const divisions = (body.divisions ?? []) as DivisionReadiness[];
        const withGroups = divisions.filter((d) => d.groupId);
        setNationalOptions(withGroups);
        const first = withGroups[0]?.groupId ?? null;
        setGroupId(first);
        if (first) await loadTeams(first);
        else onGroupChange(null, []);
      } else if (regionCode) {
        const res = await fetch(
          `/api/admin/competition/regional/readiness?region=${regionCode}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setRegionalOptions([]);
          setLoading(false);
          onGroupChange(null, []);
          return;
        }
        const body = await res.json();
        const groups = (body.groups ?? []) as GroupReadiness[];
        setRegionalOptions(groups);
        const first = groups[0]?.groupId ?? null;
        setGroupId(first);
        if (first) await loadTeams(first);
        else onGroupChange(null, []);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [scope, regionCode, loadTeams, onGroupChange]);

  async function handleGroupChange(nextId: string) {
    const gid = nextId || null;
    setGroupId(gid);
    if (gid) await loadTeams(gid);
    else onGroupChange(null, []);
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">{tDiscipline("loadingGroups")}</p>;
  }

  const optionCount =
    scope === SCOPES.NATIONAL
      ? nationalOptions.length
      : regionalOptions.length;

  if (optionCount === 0) {
    return (
      <p className="text-sm text-zinc-600">
        {tDiscipline("noGroups")}{" "}
        <a href="/admin/competition" className="link font-medium">
          {tDiscipline("competitionSetupLink")}
        </a>
      </p>
    );
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-zinc-700">
        {scope === SCOPES.NATIONAL ? t("divisionGroup") : tDiscipline("group")}
      </span>
      <select
        value={groupId ?? ""}
        onChange={(e) => void handleGroupChange(e.target.value)}
        className="input max-w-md"
      >
        {scope === SCOPES.NATIONAL
          ? nationalOptions.map((d) => (
              <option key={d.groupId!} value={d.groupId!}>
                {t("option", {
                  name: translateDivisionName(d.name, tDivisions),
                  teamCount: d.teamCount,
                })}
              </option>
            ))
          : regionalOptions.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {groupLabel(g)}
              </option>
            ))}
      </select>
    </label>
  );
}
