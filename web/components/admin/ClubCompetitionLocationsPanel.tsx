"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { formatClubAddress } from "@/lib/competition/club-address";

type RegionInfo = { code: string; name: string };

type ClubRow = {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  location: string | null;
  competition_location: string | null;
  region?: RegionInfo | RegionInfo[] | null;
};

type Props = {
  regionId?: string;
  showRegionColumn?: boolean;
};

function unwrapRegion(
  region: RegionInfo | RegionInfo[] | null | undefined,
): RegionInfo | null {
  if (!region) return null;
  if (Array.isArray(region)) return region[0] ?? null;
  return region;
}

export function ClubCompetitionLocationsPanel({
  regionId,
  showRegionColumn = false,
}: Props) {
  const t = useTranslations("admin.clubLocations");
  const tCommon = useTranslations("common");

  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadClubs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = regionId
        ? `/api/admin/competition/clubs?regionId=${regionId}`
        : "/api/admin/competition/clubs";
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("loadFailed"));
      const rows = (body.clubs ?? []) as ClubRow[];
      setClubs(rows);
      setDrafts(
        Object.fromEntries(
          rows.map((c) => [c.id, c.competition_location ?? ""]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [regionId, t]);

  useEffect(() => {
    void loadClubs();
  }, [loadClubs]);

  async function saveClub(clubId: string) {
    const draft = drafts[clubId] ?? "";
    const trimmed = draft.trim();
    const club = clubs.find((c) => c.id === clubId);
    const current = club?.competition_location?.trim() ?? "";
    if (trimmed === current) return;

    setSavingId(clubId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/competition/clubs/${clubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_location: trimmed ? trimmed : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("saveFailed"));
      const updated = body.club as ClubRow;
      setClubs((prev) =>
        prev.map((c) => (c.id === clubId ? { ...c, ...updated } : c)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">{tCommon("loading")}</p>;
  }

  if (clubs.length === 0) {
    return <p className="text-sm text-amber-800">{t("noClubs")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <th className="pb-2 pr-4 font-medium">{t("club")}</th>
              {showRegionColumn ? (
                <th className="pb-2 pr-4 font-medium">{t("region")}</th>
              ) : null}
              <th className="pb-2 pr-4 font-medium">{t("defaultLocation")}</th>
              <th className="pb-2 font-medium">{t("competitionLocation")}</th>
            </tr>
          </thead>
          <tbody>
            {clubs.map((club) => {
              const region = unwrapRegion(club.region);
              const defaultAddress = formatClubAddress(club);
              return (
                <tr key={club.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-4 font-medium text-zinc-900">
                    {club.name}
                  </td>
                  {showRegionColumn ? (
                    <td className="py-2 pr-4 text-zinc-600">
                      {region?.name ?? "—"}
                    </td>
                  ) : null}
                  <td className="py-2 pr-4 text-zinc-600">
                    {defaultAddress ? (
                      defaultAddress
                    ) : (
                      <span className="text-zinc-400">{t("defaultNotSet")}</span>
                    )}
                  </td>
                  <td className="py-2">
                    <input
                      type="text"
                      className="input w-full min-w-[12rem] text-sm"
                      value={drafts[club.id] ?? ""}
                      placeholder={t("competitionLocationPlaceholder")}
                      disabled={savingId === club.id}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [club.id]: e.target.value,
                        }))
                      }
                      onBlur={() => void saveClub(club.id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">{t("competitionLocationHint")}</p>
    </div>
  );
}
