"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SCOPES, type RegionCode } from "@/lib/competition/scopes";

type Props = {
  scope: typeof SCOPES.NATIONAL | typeof SCOPES.REGIONAL;
  regionCode?: RegionCode;
  leagueId: string | null;
  rostersLocked: boolean;
  onChanged: () => void | Promise<void>;
};

export function RosterLockSection({
  scope,
  regionCode,
  leagueId,
  rostersLocked,
  onChanged,
}: Props) {
  const t = useTranslations("admin.rosterLock");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!leagueId) return null;

  async function patchRosters(locked: boolean) {
    const confirmMessage = locked ? t("lockConfirm") : t("unlockConfirm");
    if (!window.confirm(confirmMessage)) return;

    setBusy(true);
    setError(null);
    const action =
      scope === SCOPES.NATIONAL
        ? locked
          ? "lock_national_rosters"
          : "unlock_national_rosters"
        : locked
          ? "lock_regional_rosters"
          : "unlock_regional_rosters";

    const body: Record<string, string | boolean> = { action };
    if (scope === SCOPES.REGIONAL && regionCode) {
      body.regionCode = regionCode;
    }

    const res = await fetch("/api/admin/competition", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(
        typeof data.error === "string" ? data.error : t("requestFailed"),
      );
      return;
    }

    await onChanged();
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <h2 className="text-sm font-semibold text-zinc-900">{t("title")}</h2>
      <p className="mt-1 text-sm text-zinc-600">
        {rostersLocked ? t("lockedDescription") : t("unlockedDescription")}
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {rostersLocked ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void patchRosters(false)}
          >
            {busy ? t("working") : t("unlock")}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void patchRosters(true)}
          >
            {busy ? t("working") : t("lock")}
          </button>
        )}
      </div>
    </section>
  );
}
