"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { RegionalReadiness } from "@/lib/competition/regional-readiness";
import { buildTranslatedRegionalBlockers } from "@/lib/i18n/labels";
import {
  groupLabel,
  groupTeamsStatusLabel,
} from "@/lib/competition/regional-readiness";

type Props = {
  readiness: RegionalReadiness | null;
  loading?: boolean;
  onStart: () => Promise<void>;
};

export function RegionalStartLeagueSection({
  readiness,
  loading = false,
  onStart,
}: Props) {
  const t = useTranslations("admin.regionalStartLeague");
  const tBlockers = useTranslations("admin.regionalBlockers");

  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const translatedBlockers = useMemo(
    () =>
      readiness ? buildTranslatedRegionalBlockers(readiness, tBlockers) : [],
    [readiness, tBlockers],
  );

  const isSetup = readiness?.seasonStatus === "setup";
  const canStart = readiness?.canStartLeague ?? false;
  const schedulesExist = readiness?.allSchedulesReady ?? false;

  async function handleStart() {
    if (!canStart) return;
    const confirmMessage = schedulesExist
      ? t("confirmWithFixtures")
      : t("confirmGenerate");
    if (!confirm(confirmMessage)) {
      return;
    }
    setStarting(true);
    setMessage(null);
    try {
      await onStart();
      setMessage(t("started"));
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Failed to start league",
      );
    } finally {
      setStarting(false);
    }
  }

  if (!readiness) {
    return (
      <section className="card">
        <p className="text-sm text-zinc-600">{t("loading")}</p>
      </section>
    );
  }

  if (!isSetup) {
    return (
      <section className="card flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">{t("statusTitle")}</h2>
        <p className="text-sm text-zinc-600">
          {t("statusBody", { status: readiness.seasonStatus })}
        </p>
      </section>
    );
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
      </div>

      <ul className="space-y-2 text-sm text-zinc-800">
        <CheckItem
          ok={readiness.calendar.complete}
          label={t("calendarCheck", {
            set: readiness.calendar.set,
            required: readiness.calendar.required,
          })}
        />
        {readiness.groups.map((group) => (
          <CheckItem
            key={group.groupId}
            ok={group.groupReady}
            label={
              group.groupReady
                ? t("groupReady", { label: groupLabel(group) })
                : !group.datesComplete
                  ? t("groupDates", { label: groupLabel(group) })
                  : t("groupTeams", {
                      label: groupLabel(group),
                      teamLabel: groupTeamsStatusLabel(group),
                    })
            }
          />
        ))}
        {readiness.groups.length > 0 && (
          <CheckItem
            ok={readiness.allSchedulesReady}
            label={t("fixturesCheck")}
          />
        )}
      </ul>

      {translatedBlockers.length > 0 && !canStart && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">{t("stillNeeded")}</p>
          <ul className="mt-1 list-inside list-disc">
            {translatedBlockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        disabled={!canStart || starting || loading}
        onClick={handleStart}
        className="btn-danger w-fit disabled:opacity-50"
        title={
          canStart ? undefined : translatedBlockers[0] ?? t("completeSetupFirst")
        }
      >
        {starting ? t("starting") : t("startButton")}
      </button>

      {message && (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${ok ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-600"}`}
        aria-hidden
      >
        {ok ? "✓" : "·"}
      </span>
      {label}
    </li>
  );
}
