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
import { MatchLogViewer } from "./MatchLogViewer";

type Props = {
  scope: CompetitionScope;
  regionCode?: RegionCode;
};

export function AdminAuditLogPage({ scope, regionCode }: Props) {
  const t = useTranslations("admin");
  const tAudit = useTranslations("admin.auditLogPage");

  const scopeTitle =
    scope === SCOPES.NATIONAL
      ? t("national")
      : translateRegionalScopeTitle(regionCode!, t);

  const [groupId, setGroupId] = useState<string | null>(null);

  const handleGroupChange = useCallback(
    (gid: string | null, _teams: AdminGroupTeam[]) => {
      setGroupId(gid);
    },
    [],
  );

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href="/admin/audit-log" className="link-back">
          {t("backAuditLog")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {tAudit("title")} — {scopeTitle}
        </h1>
        <p className="text-sm text-zinc-600">{tAudit("description")}</p>
      </header>

      <AdminScopeGroupPicker
        scope={scope}
        regionCode={regionCode}
        onGroupChange={handleGroupChange}
      />

      <MatchLogViewer groupId={groupId} />
    </main>
  );
}
