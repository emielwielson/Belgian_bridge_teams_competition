"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MissingScoreDivision } from "@/lib/competition/missing-scores";
import {
  SCOPES,
  type CompetitionScope,
  type RegionCode,
} from "@/lib/competition/scopes";
import { translateRegionalScopeTitle } from "@/lib/i18n/labels";
import { MissingScoresList } from "./MissingScoresList";

type Props = {
  scope: CompetitionScope;
  regionCode?: RegionCode;
};

export function AdminMissingScoresPage({ scope, regionCode }: Props) {
  const t = useTranslations("admin");
  const tPage = useTranslations("admin.missingScoresPage");

  const scopeTitle =
    scope === SCOPES.NATIONAL
      ? t("national")
      : translateRegionalScopeTitle(regionCode!, t);

  const [divisions, setDivisions] = useState<MissingScoreDivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const params = new URLSearchParams({ scope });
    if (scope === SCOPES.REGIONAL && regionCode) {
      params.set("region", regionCode);
    }
    try {
      const res = await fetch(`/api/admin/missing-scores?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? tPage("loadFailed"));
      setDivisions(body.divisions ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : tPage("loadFailed"));
      setDivisions([]);
    } finally {
      setLoading(false);
    }
  }, [scope, regionCode, tPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const showGroupColumn =
    scope === SCOPES.REGIONAL &&
    divisions.some((d) =>
      d.matches.some((m) => m.groupName !== d.name),
    );

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href="/admin/missing-scores" className="link-back">
          {t("backMissingScores")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {tPage("title")} — {scopeTitle}
        </h1>
        <p className="text-sm text-zinc-600">{tPage("description")}</p>
      </header>

      {message ? (
        <p className="text-sm text-zinc-700">{message}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-600">{tPage("loading")}</p>
      ) : (
        <MissingScoresList
          divisions={divisions}
          showGroupColumn={showGroupColumn}
        />
      )}
    </main>
  );
}
