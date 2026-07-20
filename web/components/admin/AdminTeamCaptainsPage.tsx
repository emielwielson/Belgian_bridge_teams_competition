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
import { AdminScopeGroupPicker } from "./AdminScopeGroupPicker";
import { TeamCaptainsPanel } from "./TeamCaptainsPanel";

type Props = {
  scope: CompetitionScope;
  regionCode?: RegionCode;
};

export function AdminTeamCaptainsPage({ scope, regionCode }: Props) {
  const t = useTranslations("admin");
  const tPage = useTranslations("admin.teamCaptainsPage");

  const scopeTitle =
    scope === SCOPES.NATIONAL
      ? t("national")
      : translateRegionalScopeTitle(regionCode!, t);

  const [groupId, setGroupId] = useState<string | null>(null);

  const handleGroupChange = useCallback((gid: string | null) => {
    setGroupId(gid);
  }, []);

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href="/admin/team-captains" className="link-back">
          {t("backTeamCaptains")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {tPage("title")} — {scopeTitle}
        </h1>
        <p className="text-sm text-zinc-600">{tPage("description")}</p>
      </header>

      <AdminScopeGroupPicker
        scope={scope}
        regionCode={regionCode}
        onGroupChange={(gid) => handleGroupChange(gid)}
      />

      <TeamCaptainsPanel groupId={groupId} />
    </main>
  );
}
