"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";

type Props = {
  teamId: string;
  locationOverride: string | null;
  clubLocation: string | null;
  onClose: () => void;
  onSaved: (result: {
    location: string | null;
    locationOverride: string | null;
    clubLocation: string | null;
  }) => void;
};

export function TeamLocationModal({
  teamId,
  locationOverride,
  clubLocation,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations("team.locationEdit");
  const translateApiError = useTranslateApiError();
  const [draft, setDraft] = useState(locationOverride ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOverride = Boolean(locationOverride?.trim());

  async function save(next: string | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: next }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          body.error
            ? translateApiError(body.error, body.errorParams)
            : t("saveFailed"),
        );
      }
      onSaved({
        location: body.location ?? null,
        locationOverride: body.locationOverride ?? null,
        clubLocation: body.clubLocation ?? clubLocation,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg"
        role="dialog"
        aria-labelledby="team-location-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h4
          id="team-location-modal-title"
          className="text-sm font-semibold text-zinc-900"
        >
          {t("title")}
        </h4>
        <p className="mt-2 text-sm text-zinc-600">{t("description")}</p>

        <p className="mt-3 text-xs font-medium text-zinc-500">
          {t("clubLocationLabel")}
        </p>
        <p className="mt-0.5 text-sm text-zinc-800">
          {clubLocation?.trim() ? clubLocation : t("clubLocationNotSet")}
        </p>

        <label
          htmlFor="team-location-input"
          className="mt-4 block text-xs font-medium text-zinc-500"
        >
          {t("customLocationLabel")}
        </label>
        <input
          id="team-location-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
          placeholder={t("customLocationPlaceholder")}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:opacity-60"
        />

        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => void save(null)}
            disabled={saving || !hasOverride}
            className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {t("useClubLocation")}
          </button>
          <button
            type="button"
            onClick={() => void save(draft.trim() ? draft.trim() : null)}
            disabled={saving}
            className="btn-primary px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
