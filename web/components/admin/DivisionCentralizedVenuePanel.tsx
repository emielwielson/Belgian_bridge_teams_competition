"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  divisionId: string;
  initialLocation?: string | null;
  onSaved?: () => void;
};

export function DivisionCentralizedVenuePanel({
  divisionId,
  initialLocation = null,
  onSaved,
}: Props) {
  const t = useTranslations("admin.clubLocations");
  const tCommon = useTranslations("common");

  const [value, setValue] = useState(initialLocation ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(initialLocation ?? "");
  }, [initialLocation, divisionId]);

  async function save() {
    const trimmed = value.trim();
    const current = initialLocation?.trim() ?? "";
    if (trimmed === current) return;

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/competition", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "division",
          id: divisionId,
          centralized_location: trimmed ? trimmed : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("saveFailed"));
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">
          {t("centralizedVenue")}
        </h3>
        <p className="mt-1 text-xs text-zinc-600">{t("honorDivisionVenueNote")}</p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {t("saved")}
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700">
          {t("centralizedVenue")}
        </span>
        <input
          type="text"
          className="input max-w-lg text-sm"
          value={value}
          placeholder={t("centralizedVenuePlaceholder")}
          disabled={saving}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          onBlur={() => void save()}
        />
        <span className="text-xs text-zinc-500">{t("centralizedVenueHint")}</span>
      </label>

      {saving && (
        <p className="text-xs text-zinc-500">{tCommon("loading")}</p>
      )}
    </div>
  );
}
