"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  SCOPES,
  type CompetitionScope,
  type RegionCode,
} from "@/lib/competition/scopes";
import { translateRegionalScopeTitle } from "@/lib/i18n/labels";
import {
  AdminScopeGroupPicker,
  type AdminGroupTeam,
} from "./AdminScopeGroupPicker";
import { GroupDisciplinePanel } from "./GroupDisciplinePanel";

type Props = {
  scope: CompetitionScope;
  regionCode?: RegionCode;
};

export function AdminDisciplinePage({ scope, regionCode }: Props) {
  const t = useTranslations("admin");
  const tDiscipline = useTranslations("admin.disciplinePage");

  const scopeTitle =
    scope === SCOPES.NATIONAL
      ? t("national")
      : translateRegionalScopeTitle(regionCode!, t);

  const [groupId, setGroupId] = useState<string | null>(null);
  const [teams, setTeams] = useState<AdminGroupTeam[]>([]);

  const handleGroupChange = useCallback(
    (gid: string | null, nextTeams: AdminGroupTeam[]) => {
      setGroupId(gid);
      setTeams(nextTeams);
    },
    [],
  );

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href="/admin/discipline" className="link-back">
          {t("backDiscipline")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {tDiscipline("title")} — {scopeTitle}
        </h1>
        <p className="text-sm text-zinc-600">{tDiscipline("description")}</p>
      </header>

      <AdminScopeGroupPicker
        scope={scope}
        regionCode={regionCode}
        onGroupChange={handleGroupChange}
      />

      <GroupDisciplinePanel groupId={groupId} teams={teams} />
    </main>
  );
}
