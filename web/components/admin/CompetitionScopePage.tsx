"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { sortDivisionsByCanonicalName } from "@/lib/competition/sort-divisions";
import {
  SCOPES,
  scopeLabel,
  type CompetitionScope,
} from "@/lib/competition/scopes";
import { CompetitionManagement } from "./CompetitionManagement";
import { NationalCompetitionSetup } from "./NationalCompetitionSetup";

type DivisionLevel = { id: string; code: string; name: string };
type Group = {
  id: string;
  name: string;
  status: string;
  max_matches_per_day_per_team: number | null;
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
  const [leagues, setLeagues] = useState<League[]>([]);
  const [divisionLevels, setDivisionLevels] = useState<DivisionLevel[]>([]);
  const [seasonStatus, setSeasonStatus] = useState("setup");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [teams, setTeams] = useState<
    { id: string; name: string; club_id: string; roster: unknown[] }[]
  >([]);
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage(body.error ?? "Failed to set up regional league");
      return;
    }
    setMessage(`${scopeLabel(scope, regionCode)} league is ready.`);
    await load();
  }

  async function createDivision(leagueId: string) {
    const levelId = divisionLevels[0]?.id;
    if (!levelId) return;
    const name = prompt("Division name");
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
    const name = prompt("Group name");
    if (!name) return;
    await fetch("/api/admin/competition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "group", division_id: divisionId, name }),
    });
    await load();
  }

  async function loadTeams(groupId: string) {
    setSelectedGroupId(groupId);
    const res = await fetch(`/api/admin/competition/teams?groupId=${groupId}`);
    const body = await res.json();
    setTeams(body.teams ?? []);
  }

  async function addTeam(groupId: string) {
    const clubId = clubs[0]?.id;
    if (!clubId) {
      setMessage("Create a club first");
      return;
    }
    const name = prompt("Team name");
    if (!name) return;
    const res = await fetch("/api/admin/competition/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId, club_id: clubId, name }),
    });
    if (!res.ok) {
      const body = await res.json();
      setMessage(body.error ?? "Failed to add team");
      return;
    }
    await loadTeams(groupId);
  }

  async function removeTeam(teamId: string, groupId: string) {
    if (!confirm("Remove this team from the group?")) return;
    const res = await fetch("/api/admin/competition/teams", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: teamId }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Failed to remove team");
      return;
    }
    await loadTeams(groupId);
  }

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
      setMessage(body.error ?? "Generation failed");
      return;
    }
    setMessage(`Created ${body.matchesCreated} matches.`);
  }

  async function activateSeason() {
    const res = await fetch("/api/admin/competition", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate_season", activate_groups: true }),
    });
    if (res.ok) {
      setMessage("Season activated — rosters and memberships are now locked.");
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
          ← Scopes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {scopeLabel(scope, regionCode)}
        </h1>
        <p className="text-sm text-zinc-600">Season status: {seasonStatus}</p>
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
          Set up {scopeLabel(scope, regionCode)} league
        </button>
        {seasonStatus === "setup" && (
          <button
            type="button"
            onClick={activateSeason}
            className="btn-danger"
          >
            Activate season
          </button>
        )}
      </section>

      {leagues.map((league) => (
        <section
          key={league.id}
          className="card"
        >
          <h2 className="font-semibold text-zinc-900">{league.name}</h2>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-zinc-700 underline hover:text-zinc-900"
            onClick={() => createDivision(league.id)}
          >
            Add division
          </button>
          {sortDivisionsByCanonicalName(league.divisions).map((division) => (
            <div key={division.id} className="mt-4 border-t pt-3">
              <h3 className="text-sm font-medium text-zinc-900">{division.name}</h3>
              <button
                type="button"
                className="mt-1 text-sm font-medium text-zinc-700 underline hover:text-zinc-900"
                onClick={() => createGroup(division.id)}
              >
                Add group
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
                      onClick={() => loadTeams(group.id)}
                    >
                      {group.name}
                    </button>
                    <span className="text-xs text-zinc-500">{group.status}</span>
                    {group.max_matches_per_day_per_team != null && (
                      <span className="text-xs text-zinc-500">
                        max {group.max_matches_per_day_per_team}/day
                      </span>
                    )}
                    <button
                      type="button"
                      className="text-xs font-medium text-zinc-700 underline"
                      onClick={() => addTeam(group.id)}
                    >
                      Add team
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-zinc-700 underline"
                      onClick={() => generateSchedule(group.id)}
                    >
                      Generate schedule
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      {selectedGroupId && (
        <section className="card">
          <h2 className="font-semibold text-zinc-900">
            Teams ({teams.length}/8 for RBBF)
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-800">
            {teams.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {t.name} — roster: {t.roster?.length ?? 0}
                </span>
                <button
                  type="button"
                  className="text-xs font-medium text-red-700 underline"
                  onClick={() => removeTeam(t.id, selectedGroupId)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
