"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RegionalReadiness } from "@/lib/competition/regional-readiness";
import { SCOPES, type RegionCode } from "@/lib/competition/scopes";
import { translateRegionalScopeTitle } from "@/lib/i18n/labels";
import { sortDivisionsByCanonicalName } from "@/lib/competition/sort-divisions";
import { CompetitionManagement } from "./CompetitionManagement";
import { RegionalStartLeagueSection } from "./RegionalStartLeagueSection";
import { RegionalStructureSetup } from "./RegionalStructureSetup";
import { RegionalTeamsSetup } from "./RegionalTeamsSetup";

type SetupTab = "dates" | "structure" | "teams" | "start";

type DivisionLevel = { id: string; code: string; name: string };
type Group = {
  id: string;
  name: string;
  status: string;
  round_count: number;
  round_robin_count: number;
};
type Division = { id: string; name: string; league_id: string; groups: Group[] };
type League = {
  id: string;
  name: string;
  scope: string;
  region_id: string | null;
  divisions: Division[];
};

type Props = {
  regionCode: RegionCode;
  regionId: string;
};

function tabComplete(tab: SetupTab, readiness: RegionalReadiness | null): boolean {
  if (!readiness) return false;
  if (tab === "dates") return readiness.calendar.complete;
  if (tab === "structure") {
    return readiness.leagueId !== null && readiness.groups.length > 0;
  }
  if (tab === "teams") return readiness.allGroupsReady;
  return readiness.canStartLeague;
}

export function RegionalCompetitionSetup({ regionCode, regionId }: Props) {
  const t = useTranslations("admin");
  const tTabs = useTranslations("admin.regionalTabs");

  const [activeTab, setActiveTab] = useState<SetupTab>("dates");
  const [readiness, setReadiness] = useState<RegionalReadiness | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [divisionLevels, setDivisionLevels] = useState<DivisionLevel[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [structureLoading, setStructureLoading] = useState(true);

  const scopeTitle = translateRegionalScopeTitle(regionCode, t);

  const tabs: { id: SetupTab; label: string }[] = [
    { id: "dates", label: tTabs("matchDays") },
    { id: "structure", label: tTabs("structure") },
    { id: "teams", label: tTabs("teams") },
    { id: "start", label: tTabs("startLeague") },
  ];

  const loadReadiness = useCallback(async () => {
    const res = await fetch(
      `/api/admin/competition/regional/readiness?region=${regionCode}`,
    );
    if (!res.ok) return;
    setReadiness(await res.json());
  }, [regionCode]);

  const loadLeagues = useCallback(async () => {
    const res = await fetch("/api/admin/competition");
    if (!res.ok) return;
    const body = await res.json();
    setDivisionLevels(body.divisionLevels ?? []);
    const filtered = (body.leagues ?? []).filter(
      (l: League) =>
        l.scope === SCOPES.REGIONAL && l.region_id === regionId,
    );
    setLeagues(filtered);
  }, [regionId]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadReadiness(), loadLeagues()]);
  }, [loadReadiness, loadLeagues]);

  useEffect(() => {
    async function init() {
      setStructureLoading(true);
      const res = await fetch("/api/admin/competition", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ensure_regional_league",
          regionCode,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setMessage(body.error ?? tTabs("structureFailed"));
      } else {
        setMessage(null);
      }
      setStructureLoading(false);
      await loadAll();
    }
    void init();
  }, [regionCode, loadAll, tTabs]);

  async function startLeague() {
    const res = await fetch("/api/admin/competition", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start_regional_league",
        regionCode,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error ?? tTabs("startFailed"));
    }
    await loadAll();
  }

  const setupLocked = readiness?.seasonStatus !== "setup";

  const filteredLeagues = leagues.map((league) => ({
    ...league,
    divisions: sortDivisionsByCanonicalName(league.divisions).map((d) => ({
      ...d,
      groups: d.groups,
    })),
  }));

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href="/admin/competition" className="link-back">
          {t("backScopes")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {scopeTitle}
        </h1>
        <p className="text-sm text-zinc-600">
          {t("seasonStatus", { status: readiness?.seasonStatus ?? "…" })}
          {structureLoading && t("settingUpStructure")}
        </p>
      </header>

      {message && (
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
          {message}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <nav
          className="flex gap-1 border-b border-zinc-200"
          aria-label={tTabs("ariaLabel")}
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            const complete = tabComplete(tab.id, readiness);
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`regional-tab-${tab.id}`}
                id={`regional-tab-${tab.id}-trigger`}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  selected
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700",
                ].join(" ")}
              >
                {tab.label}
                {readiness && (
                  <span
                    className={[
                      "inline-block h-2 w-2 shrink-0 rounded-full",
                      complete ? "bg-green-600" : "bg-zinc-300",
                    ].join(" ")}
                    aria-label={
                      complete ? tTabs("complete") : tTabs("incomplete")
                    }
                  />
                )}
              </button>
            );
          })}
        </nav>

        {activeTab === "dates" && (
          <div
            id="regional-tab-dates"
            role="tabpanel"
            aria-labelledby="regional-tab-dates-trigger"
            className="flex flex-col gap-4 pt-2"
          >
            <p className="text-sm text-zinc-600">{tTabs("matchDaysIntro")}</p>
            <CompetitionManagement
              scope={SCOPES.REGIONAL}
              regionCode={regionCode}
              readOnly={setupLocked}
              onSaved={loadReadiness}
            />
          </div>
        )}

        {activeTab === "structure" && (
          <div
            id="regional-tab-structure"
            role="tabpanel"
            aria-labelledby="regional-tab-structure-trigger"
            className="flex flex-col gap-4 pt-2"
          >
            <p className="text-sm text-zinc-600">{tTabs("structureIntro")}</p>
            <RegionalStructureSetup
              leagues={filteredLeagues}
              divisionLevels={divisionLevels}
              readOnly={setupLocked}
              onChanged={loadAll}
            />
          </div>
        )}

        {activeTab === "teams" && (
          <div
            id="regional-tab-teams"
            role="tabpanel"
            aria-labelledby="regional-tab-teams-trigger"
            className="flex flex-col gap-4 pt-2"
          >
            <RegionalTeamsSetup
              regionId={regionId}
              leagues={filteredLeagues}
              scheduleSettingsLocked={setupLocked}
              onStructureChanged={loadAll}
              onTeamsChanged={loadReadiness}
            />
          </div>
        )}

        {activeTab === "start" && (
          <div
            id="regional-tab-start"
            role="tabpanel"
            aria-labelledby="regional-tab-start-trigger"
            className="flex flex-col gap-4 pt-2"
          >
            <RegionalStartLeagueSection
              readiness={readiness}
              loading={structureLoading}
              onStart={startLeague}
            />
          </div>
        )}
      </div>
    </main>
  );
}
