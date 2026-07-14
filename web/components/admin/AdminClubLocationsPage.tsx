"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ClubCompetitionLocationsPanel } from "@/components/admin/ClubCompetitionLocationsPanel";
import { DivisionCentralizedVenuePanel } from "@/components/admin/DivisionCentralizedVenuePanel";
import { translateRegionalScopeTitle } from "@/lib/i18n/labels";
import { REGION_CODES, type RegionCode } from "@/lib/competition/scopes";

type RegionRow = { id: string; code: string; name: string };

type DivisionMeta = {
  id: string;
  name: string;
  centralized_location: string | null;
};

type Props = {
  regions: RegionRow[];
};

const HONOR_DIVISION_NAME = "Honor Division";

export function AdminClubLocationsPage({ regions }: Props) {
  const t = useTranslations("admin");

  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [honorDivision, setHonorDivision] = useState<DivisionMeta | null>(null);
  const [honorLoading, setHonorLoading] = useState(true);

  const loadHonorDivision = useCallback(async () => {
    setHonorLoading(true);
    try {
      const res = await fetch("/api/admin/competition");
      if (!res.ok) return;
      const body = await res.json();
      const nationalLeague = (body.leagues ?? []).find(
        (l: { scope: string }) => l.scope === "national",
      );
      const divisions = (nationalLeague?.divisions ?? []) as DivisionMeta[];
      setHonorDivision(
        divisions.find((d) => d.name === HONOR_DIVISION_NAME) ?? null,
      );
    } finally {
      setHonorLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHonorDivision();
  }, [loadHonorDivision]);

  const regionLabel = useCallback(
    (code: string, name: string) => {
      if (code === REGION_CODES.FLANDERS || code === REGION_CODES.WALLONIA) {
        return translateRegionalScopeTitle(code as RegionCode, t);
      }
      return name;
    },
    [t],
  );

  const regionOptions = useMemo(
    () =>
      regions.map((r) => ({
        id: r.id,
        label: regionLabel(r.code, r.name),
      })),
    [regions, regionLabel],
  );

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href="/admin" className="link-back">
          {t("backAdmin")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {t("clubLocationsPageTitle")}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {t("clubLocationsPageDescription")}
        </p>
      </header>

      <section className="card flex flex-col gap-4">
        {!honorLoading && honorDivision ? (
          <DivisionCentralizedVenuePanel
            divisionId={honorDivision.id}
            initialLocation={honorDivision.centralized_location}
            onSaved={loadHonorDivision}
          />
        ) : honorLoading ? (
          <p className="text-sm text-zinc-600">{t("clubLocationsLoadingHonor")}</p>
        ) : (
          <p className="text-sm text-amber-800">{t("clubLocationsHonorNotFound")}</p>
        )}
      </section>

      <section className="card flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">
            {t("clubLocationsRegionFilter")}
          </span>
          <select
            value={selectedRegionId}
            onChange={(e) => setSelectedRegionId(e.target.value)}
            className="input max-w-md"
          >
            <option value="">{t("clubLocationsAllRegions")}</option>
            {regionOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <ClubCompetitionLocationsPanel
          regionId={selectedRegionId || undefined}
          showRegionColumn={!selectedRegionId}
        />
      </section>
    </main>
  );
}
