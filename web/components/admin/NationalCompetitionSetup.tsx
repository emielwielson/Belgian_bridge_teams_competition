"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { NationalReadiness } from "@/lib/competition/national-readiness";
import { SCOPES } from "@/lib/competition/scopes";
import { translateScheduleLabel } from "@/lib/i18n/labels";
import type { NationalScheduleKey } from "@/lib/competition/national-structure";
import { NationalMatchDatesEditor } from "./NationalMatchDatesEditor";
import { NationalStartLeagueSection } from "./NationalStartLeagueSection";
import { NationalTeamsByDivision } from "./NationalTeamsByDivision";
import { RosterLockSection } from "./RosterLockSection";

const NATIONAL_SCHEDULE_KEYS: NationalScheduleKey[] = [
  "honor",
  "first",
  "default",
];

type SetupTab = "dates" | "teams" | "start";

function tabComplete(tab: SetupTab, readiness: NationalReadiness | null): boolean {
  if (!readiness) return false;
  if (tab === "dates") {
    return (
      readiness.calendars.honor.complete &&
      readiness.calendars.first.complete &&
      readiness.calendars.default.complete
    );
  }
  if (tab === "teams") {
    return readiness.allTeamsReady;
  }
  return readiness.canStartLeague;
}

export function NationalCompetitionSetup() {
  const t = useTranslations("admin");
  const tTabs = useTranslations("admin.nationalTabs");
  const tDivisions = useTranslations("divisions");

  const [activeTab, setActiveTab] = useState<SetupTab>("dates");
  const [readiness, setReadiness] = useState<NationalReadiness | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [structureLoading, setStructureLoading] = useState(true);

  const tabs: { id: SetupTab; label: string }[] = [
    { id: "dates", label: tTabs("matchDays") },
    { id: "teams", label: tTabs("teams") },
    { id: "start", label: tTabs("startLeague") },
  ];

  const loadReadiness = useCallback(async () => {
    const res = await fetch("/api/admin/competition/national/readiness");
    if (!res.ok) return;
    setReadiness(await res.json());
  }, []);

  useEffect(() => {
    async function init() {
      setStructureLoading(true);
      const res = await fetch("/api/admin/competition", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure_national_structure" }),
      });
      if (!res.ok) {
        const body = await res.json();
        setMessage(body.error ?? tTabs("structureFailed"));
      } else {
        setMessage(null);
      }
      setStructureLoading(false);
      await loadReadiness();
    }
    void init();
  }, [loadReadiness, tTabs]);

  async function startLeague() {
    const res = await fetch("/api/admin/competition", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_national_league" }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error ?? tTabs("startFailed"));
    }
    await loadReadiness();
  }

  const setupLocked = readiness?.seasonStatus !== "setup";
  const teamsReadOnly = readiness?.rostersLocked ?? false;

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href="/admin/competition" className="link-back">
          {t("backScopes")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{t("national")}</h1>
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
                aria-controls={`national-tab-${tab.id}`}
                id={`national-tab-${tab.id}-trigger`}
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
                    aria-label={complete ? tTabs("complete") : tTabs("incomplete")}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {activeTab === "dates" && (
          <div
            id="national-tab-dates"
            role="tabpanel"
            aria-labelledby="national-tab-dates-trigger"
            className="flex flex-col gap-4 pt-2"
          >
            <p className="text-sm text-zinc-600">{tTabs("matchDaysIntro")}</p>
            <div className="flex flex-col gap-4">
              {NATIONAL_SCHEDULE_KEYS.map((key) => (
                <NationalMatchDatesEditor
                  key={key}
                  scope={SCOPES.NATIONAL}
                  scheduleKey={key}
                  title={translateScheduleLabel(key, tDivisions)}
                  readOnly={setupLocked}
                  onSaved={loadReadiness}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === "teams" && (
          <div
            id="national-tab-teams"
            role="tabpanel"
            aria-labelledby="national-tab-teams-trigger"
            className="flex flex-col gap-4 pt-2"
          >
            <RosterLockSection
              scope={SCOPES.NATIONAL}
              leagueId={readiness?.leagueId ?? null}
              rostersLocked={readiness?.rostersLocked ?? false}
              onChanged={loadReadiness}
            />
            <NationalTeamsByDivision
              divisions={readiness?.divisions ?? []}
              readOnly={teamsReadOnly}
              onTeamsChanged={loadReadiness}
            />
          </div>
        )}

        {activeTab === "start" && (
          <div
            id="national-tab-start"
            role="tabpanel"
            aria-labelledby="national-tab-start-trigger"
            className="pt-2"
          >
            <NationalStartLeagueSection
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
