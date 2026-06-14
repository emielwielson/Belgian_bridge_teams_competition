"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { TeamsSetupPanel } from "@/components/admin/TeamsSetupPanel";
import { NATIONAL_DIVISIONS } from "@/lib/competition/national-structure";
import { NATIONAL_TEAMS_PER_GROUP } from "@/lib/competition/national-teams";
import type { DivisionReadiness } from "@/lib/competition/national-readiness";
import { translateDivisionName } from "@/lib/i18n/labels";

type Club = { id: string; name: string };

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

  const division = divisions.find((d) => d.name === selectedDivision);
  const groupId = division?.groupId ?? null;
  const divisionLabel = translateDivisionName(selectedDivision, tDivisions);

  useEffect(() => {
    fetch("/api/admin/competition/clubs")
      .then((r) => r.json())
      .then((b) => setClubs(b.clubs ?? []));
  }, []);

  const handleTeamsChanged = useCallback(() => {
    onTeamsChanged?.();
  }, [onTeamsChanged]);

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
