"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ClubCompetitionLocationsPanel } from "@/components/admin/ClubCompetitionLocationsPanel";
import { DivisionCentralizedVenuePanel } from "@/components/admin/DivisionCentralizedVenuePanel";
import { TeamsSetupPanel } from "@/components/admin/TeamsSetupPanel";
import { NATIONAL_DIVISIONS } from "@/lib/competition/national-structure";
import { NATIONAL_TEAMS_PER_GROUP } from "@/lib/competition/national-teams";
import type { DivisionReadiness } from "@/lib/competition/national-readiness";
import { translateDivisionName } from "@/lib/i18n/labels";

type Club = { id: string; name: string };

type DivisionMeta = {
  id: string;
  name: string;
  centralized_location: string | null;
};

type Props = {
  divisions: DivisionReadiness[];
  onTeamsChanged?: () => void;
};

export function NationalTeamsByDivision({
  divisions,
  onTeamsChanged,
}: Props) {
  const t = useTranslations("admin.nationalTeams");
  const tDivisions = useTranslations("divisions");

  const [selectedDivision, setSelectedDivision] = useState(
    NATIONAL_DIVISIONS[0]?.name ?? "",
  );
  const [clubs, setClubs] = useState<Club[]>([]);
  const [divisionMeta, setDivisionMeta] = useState<DivisionMeta[]>([]);

  const division = divisions.find((d) => d.name === selectedDivision);
  const groupId = division?.groupId ?? null;
  const divisionLabel = translateDivisionName(selectedDivision, tDivisions);

  const selectedSpec = NATIONAL_DIVISIONS.find((d) => d.name === selectedDivision);
  const isHonorDivision = selectedSpec?.divisionLevelCode === "honor";

  const selectedDivisionMeta = useMemo(
    () => divisionMeta.find((d) => d.name === selectedDivision) ?? null,
    [divisionMeta, selectedDivision],
  );

  useEffect(() => {
    fetch("/api/admin/competition/clubs")
      .then((r) => r.json())
      .then((b) => setClubs(b.clubs ?? []));
  }, []);

  const loadDivisionMeta = useCallback(async () => {
    const res = await fetch("/api/admin/competition");
    if (!res.ok) return;
    const body = await res.json();
    const nationalLeague = (body.leagues ?? []).find(
      (l: { scope: string }) => l.scope === "national",
    );
    const meta = (nationalLeague?.divisions ?? []) as DivisionMeta[];
    setDivisionMeta(meta);
  }, []);

  useEffect(() => {
    void loadDivisionMeta();
  }, [loadDivisionMeta]);

  const handleTeamsChanged = useCallback(() => {
    onTeamsChanged?.();
  }, [onTeamsChanged]);

  const handleVenueSaved = useCallback(() => {
    void loadDivisionMeta();
    onTeamsChanged?.();
  }, [loadDivisionMeta, onTeamsChanged]);

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">{t("division")}</span>
        <select
          value={selectedDivision}
          onChange={(e) => setSelectedDivision(e.target.value)}
          className="input max-w-md"
        >
          {NATIONAL_DIVISIONS.map((d) => (
            <option key={d.name} value={d.name}>
              {translateDivisionName(d.name, tDivisions)}
            </option>
          ))}
        </select>
      </label>

      {isHonorDivision && selectedDivisionMeta && (
        <DivisionCentralizedVenuePanel
          divisionId={selectedDivisionMeta.id}
          initialLocation={selectedDivisionMeta.centralized_location}
          onSaved={handleVenueSaved}
        />
      )}

      {!isHonorDivision && <ClubCompetitionLocationsPanel />}

      {!groupId && (
        <p className="text-sm text-amber-800">{t("noGroupYet")}</p>
      )}

      {groupId && (
        <TeamsSetupPanel
          groupId={groupId}
          divisionLabel={divisionLabel}
          clubs={clubs}
          maxTeams={NATIONAL_TEAMS_PER_GROUP}
          onTeamsChanged={handleTeamsChanged}
        />
      )}
    </section>
  );
}
