"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { sortDivisionsByCanonicalName } from "@/lib/competition/sort-divisions";
import {
  SCOPES,
  type CompetitionScope,
  type RegionCode,
} from "@/lib/competition/scopes";
import {
  translateLeagueName,
  translateRegionalScopeTitle,
} from "@/lib/i18n/labels";
import { CompetitionManagement } from "./CompetitionManagement";
import { NationalCompetitionSetup } from "./NationalCompetitionSetup";
import { MatchLogViewer } from "./MatchLogViewer";
import { PenaltyManagement } from "./PenaltyManagement";
import { RulingManagement } from "./RulingManagement";
import { RegionalGroupScheduleSettings } from "./RegionalGroupScheduleSettings";
import { TeamsSetupPanel } from "./TeamsSetupPanel";
import { WarningManagement } from "./WarningManagement";

type DivisionLevel = { id: string; code: string; name: string };
type Group = {
  id: string;
  name: string;
  status: string;
  max_matches_per_day_per_team: number | null;
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
  scope: CompetitionScope;
  regionCode?: string;
  regionId?: string;
};

export function CompetitionScopePage({ scope, regionCode, regionId }: Props) {
  const t = useTranslations("admin");
  const tRegions = useTranslations("regions");
  const tCommon = useTranslations("common");

  const [leagues, setLeagues] = useState<League[]>([]);
  const [divisionLevels, setDivisionLevels] = useState<DivisionLevel[]>([]);
  const [seasonStatus, setSeasonStatus] = useState("setup");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const scopeTitle =
    scope === SCOPES.NATIONAL
      ? t("national")
      : translateRegionalScopeTitle(regionCode as RegionCode | undefined, t);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/competition");
    if (!res.ok) return;
    const body = await res.json();
    setDivisionLevels(body.divisionLevels ?? []);
    setSeasonStatus(body.season?.status ?? "setup");
    const filtered = (body.leagues ?? []).filter((l: League) => {
      if (scope === SCOPES.NATIONAL) return l.scope === SCOPES.NATIONAL;
      return l.scope === SCOPES.REGIONAL && l.region_id === regionId;
    });
    setLeagues(filtered);
  }, [scope, regionId]);

  useEffect(() => {
    load();
    const clubParams = regionId ? `?regionId=${regionId}` : "";
    fetch(`/api/admin/competition/clubs${clubParams}`)
      .then((r) => r.json())
      .then((b) => setClubs(b.clubs ?? []));
  }, [load, regionId]);

  async function ensureRegionalLeague() {
    if (!regionCode) return;
    setMessage(null);
    const res = await fetch("/api/admin/competition", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ensure_regional_league",
        regionCode,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? t("generationFailed"));
      return;
    }
    setMessage(
      t("leagueReady", {
        leagueName: translateRegionalScopeTitle(
          regionCode as RegionCode,
          t,
        ),
      }),
    );
    await load();
  }

  async function createDivision(leagueId: string) {
    const levelId = divisionLevels[0]?.id;
    if (!levelId) return;
    const name = prompt(t("promptDivisionName"));
    if (!name) return;
    await fetch("/api/admin/competition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "division",
        league_id: leagueId,
        division_level_id: levelId,
        name,
      }),
    });
    await load();
  }

  async function createGroup(divisionId: string) {
    const name = prompt(t("promptGroupName"));
    if (!name) return;
    await fetch("/api/admin/competition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "group", division_id: divisionId, name }),
    });
    await load();
  }

  const refreshTeamsForGroup = useCallback(async (groupId: string) => {
    const res = await fetch(`/api/admin/competition/teams?groupId=${groupId}`);
    const body = await res.json();
    setTeams(
      (body.teams ?? []).map((t: { id: string; name: string }) => ({
        id: t.id,
        name: t.name,
      })),
    );
  }, []);

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId);
    void refreshTeamsForGroup(groupId);
  }

  const selectedGroupContext = (() => {
    if (!selectedGroupId) return null;
    for (const league of leagues) {
      for (const division of league.divisions) {
        const group = division.groups.find((g) => g.id === selectedGroupId);
        if (group) {
          return {
            group,
            divisionLabel: `${division.name} — ${group.name}`,
          };
        }
      }
    }
    return null;
  })();

  async function generateSchedule(groupId: string) {
    setMessage(null);
    const res = await fetch(
      `/api/admin/competition/groups/${groupId}/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardCount: 24 }),
      },
    );
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? t("generationFailed"));
      return;
    }
    const byeNote =
      body.byesCreated > 0
        ? t("byeNote", { byeCount: body.byesCreated })
        : "";
    setMessage(
      t("scheduleCreated", {
        matchCount: body.matchesCreated,
        byeNote,
      }),
    );
  }

  async function activateSeason() {
    const res = await fetch("/api/admin/competition", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate_season", activate_groups: true }),
    });
    if (res.ok) {
      setMessage(t("seasonActivated"));
      await load();
    }
  }

  if (scope === SCOPES.NATIONAL) {
    return <NationalCompetitionSetup />;
  }

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href="/admin/competition" className="link-back">
          {t("backScopes")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{scopeTitle}</h1>
        <p className="text-sm text-zinc-600">
          {t("seasonStatus", { status: seasonStatus })}
        </p>
      </header>

      {message && (
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">{message}</p>
      )}

      <CompetitionManagement scope={scope} regionCode={regionCode} />

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={ensureRegionalLeague}
          className="btn-secondary"
        >
          {t("setupRegionalLeague", { leagueName: scopeTitle })}
        </button>
        {seasonStatus === "setup" && (
          <button
            type="button"
            onClick={activateSeason}
            className="btn-danger"
          >
            {t("activateSeason")}
          </button>
        )}
      </section>

      {leagues.map((league) => (
        <section
          key={league.id}
          className="card"
        >
          <h2 className="font-semibold text-zinc-900">
            {translateLeagueName(league.name, tRegions)}
          </h2>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-zinc-700 underline hover:text-zinc-900"
            onClick={() => createDivision(league.id)}
          >
            {t("addDivision")}
          </button>
          {sortDivisionsByCanonicalName(league.divisions).map((division) => (
            <div key={division.id} className="mt-4 border-t pt-3">
              <h3 className="text-sm font-medium text-zinc-900">{division.name}</h3>
              <button
                type="button"
                className="mt-1 text-sm font-medium text-zinc-700 underline hover:text-zinc-900"
                onClick={() => createGroup(division.id)}
              >
                {t("addGroup")}
              </button>
              <ul className="mt-2 flex flex-col gap-2">
                {division.groups.map((group) => (
                  <li
                    key={group.id}
                    className="flex flex-wrap items-center gap-2 rounded border border-zinc-100 p-2"
                  >
                    <button
                      type="button"
                      className="font-medium text-zinc-900 underline hover:text-zinc-700"
                      onClick={() => selectGroup(group.id)}
                    >
                      {group.name}
                    </button>
                    <span className="text-xs text-zinc-500">{group.status}</span>
                    {group.max_matches_per_day_per_team != null && (
                      <span className="text-xs text-zinc-500">
                        {tCommon("maxPerDay", {
                          count: group.max_matches_per_day_per_team,
                        })}
                      </span>
                    )}
                    <button
                      type="button"
                      className="text-xs font-medium text-zinc-700 underline"
                      onClick={() => generateSchedule(group.id)}
                    >
                      {t("generateSchedule")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      {selectedGroupId && selectedGroupContext && (
        <section className="card flex flex-col gap-4">
          <h2 className="font-semibold text-zinc-900">
            {t("teamsSection", {
              divisionLabel: selectedGroupContext.divisionLabel,
              teamCount: teams.length,
              rbbfSuffix:
                teams.length === 8 ? t("rbbfTemplate") : "",
            })}
          </h2>
          <RegionalGroupScheduleSettings
            groupId={selectedGroupContext.group.id}
            teamCount={teams.length}
            roundRobinCount={selectedGroupContext.group.round_robin_count ?? 2}
            roundCount={selectedGroupContext.group.round_count ?? 14}
            onUpdated={load}
          />
          <TeamsSetupPanel
            groupId={selectedGroupId}
            divisionLabel={selectedGroupContext.divisionLabel}
            clubs={clubs}
            readOnly={seasonStatus !== "setup"}
            onTeamsChanged={() => refreshTeamsForGroup(selectedGroupId)}
          />
        </section>
      )}

      {selectedGroupId ? (
        <>
          <PenaltyManagement
            groupId={selectedGroupId}
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          />
          <WarningManagement
            groupId={selectedGroupId}
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          />
          <RulingManagement groupId={selectedGroupId} />
          <MatchLogViewer groupId={selectedGroupId} />
        </>
      ) : null}
    </main>
  );
}
