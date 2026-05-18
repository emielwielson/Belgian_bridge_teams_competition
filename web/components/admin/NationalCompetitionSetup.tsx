"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  NATIONAL_SCHEDULE_LABELS,
  type NationalScheduleKey,
} from "@/lib/competition/national-structure";
import type { NationalReadiness } from "@/lib/competition/national-readiness";
import { SCOPES } from "@/lib/competition/scopes";
import { NationalMatchDatesEditor } from "./NationalMatchDatesEditor";
import { NationalStartLeagueSection } from "./NationalStartLeagueSection";
import { NationalTeamsByDivision } from "./NationalTeamsByDivision";

const NATIONAL_SCHEDULE_KEYS: NationalScheduleKey[] = [
  "honor",
  "first",
  "default",
];

export function NationalCompetitionSetup() {
  const [readiness, setReadiness] = useState<NationalReadiness | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [structureLoading, setStructureLoading] = useState(true);

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
        setMessage(body.error ?? "Failed to set up national structure");
      } else {
        setMessage(null);
      }
      setStructureLoading(false);
      await loadReadiness();
    }
    void init();
  }, [loadReadiness]);

  async function startLeague() {
    const res = await fetch("/api/admin/competition", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_national_league" }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error ?? "Failed to start league");
    }
    await loadReadiness();
  }

  const readOnly = readiness?.seasonStatus !== "setup";

  return (
    <main className="page-container flex flex-col gap-8">
      <header>
        <Link href="/admin/competition" className="link-back">
          ← Scopes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">National</h1>
        <p className="text-sm text-zinc-600">
          Season status: {readiness?.seasonStatus ?? "…"}
          {structureLoading && " · Setting up structure…"}
        </p>
      </header>

      {message && (
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
          {message}
        </p>
      )}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">1. Match days</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Set match days for each calendar (Europe/Brussels). Start times are
            fixed per division level.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {NATIONAL_SCHEDULE_KEYS.map((key) => (
            <NationalMatchDatesEditor
              key={key}
              scope={SCOPES.NATIONAL}
              scheduleKey={key}
              title={NATIONAL_SCHEDULE_LABELS[key]}
              readOnly={readOnly}
              onSaved={loadReadiness}
            />
          ))}
        </div>
      </section>

      <NationalTeamsByDivision
        divisions={readiness?.divisions ?? []}
        readOnly={readOnly}
        onTeamsChanged={loadReadiness}
      />

      <NationalStartLeagueSection
        readiness={readiness}
        loading={structureLoading}
        onStart={startLeague}
      />
    </main>
  );
}
