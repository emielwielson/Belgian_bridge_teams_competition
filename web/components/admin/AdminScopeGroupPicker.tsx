"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  /** When true, only notify groupId changes; the parent loads team details. */
  skipTeamLoad?: boolean;
};

export function AdminScopeGroupPicker({
  scope,
  regionCode,
  onGroupChange,
  skipTeamLoad = false,
}: Props) {
  const t = useTranslations("admin.nationalDiscipline");
  const tDiscipline = useTranslations("admin.disciplinePage");
  const tDivisions = useTranslations("divisions");

  const onGroupChangeRef = useRef(onGroupChange);
  onGroupChangeRef.current = onGroupChange;

  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [nationalOptions, setNationalOptions] = useState<DivisionReadiness[]>(
    [],
  );
  const [regionalOptions, setRegionalOptions] = useState<GroupReadiness[]>([]);

  const notifyGroupChange = useCallback(
    (gid: string | null, teams: AdminGroupTeam[] = []) => {
      onGroupChangeRef.current(gid, teams);
    },
    [],
  );

  const applyGroupSelection = useCallback(
    async (gid: string | null) => {
      setGroupId(gid);
      if (!gid) {
        notifyGroupChange(null, []);
        return;
      }
      if (skipTeamLoad) {
        notifyGroupChange(gid, []);
        return;
      }
      const res = await fetch(`/api/admin/competition/teams?groupId=${gid}`);
      const body = await res.json();
      if (res.ok) {
        const teams = (body.teams ?? []).map((row: { id: string; name: string }) => ({
          id: row.id,
          name: row.name,
        }));
        notifyGroupChange(gid, teams);
      } else {
        notifyGroupChange(gid, []);
      }
    },
    [notifyGroupChange, skipTeamLoad],
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
          notifyGroupChange(null, []);
          return;
        }
        const body = await res.json();
        const divisions = (body.divisions ?? []) as DivisionReadiness[];
        const withGroups = divisions.filter((d) => d.groupId);
        setNationalOptions(withGroups);
        const first = withGroups[0]?.groupId ?? null;
        if (first) await applyGroupSelection(first);
        else notifyGroupChange(null, []);
      } else if (regionCode) {
        const res = await fetch(
          `/api/admin/competition/regional/readiness?region=${regionCode}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setRegionalOptions([]);
          setLoading(false);
          notifyGroupChange(null, []);
          return;
        }
        const body = await res.json();
        const groups = (body.groups ?? []) as GroupReadiness[];
        setRegionalOptions(groups);
        const first = groups[0]?.groupId ?? null;
        if (first) await applyGroupSelection(first);
        else notifyGroupChange(null, []);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [scope, regionCode, applyGroupSelection, notifyGroupChange]);

  async function handleGroupChange(nextId: string) {
    await applyGroupSelection(nextId || null);
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
