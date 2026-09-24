"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  HonorLockStatus,
  HonorRoundMatchSeating,
  HonorVenueTableRow,
} from "@/lib/competition/honor-seating-overview";
import type { Locale } from "@/i18n/config";
import { toIntlLocale } from "@/i18n/intl-locale";
import { formatBrussels } from "@/lib/time/brussels";
import { HonorBoardResultsEditor } from "@/components/arbiter/HonorBoardResultsEditor";
import {
  HonorButlerWorkflow,
  HonorBwsUploadStep,
  HonorPbnUploadStep,
  HonorPublishStep,
} from "@/components/arbiter/HonorButlerImportPanel";

type RoundOption = {
  round: number;
  matchDay: number;
  slotIndex: number;
  slotTime: string;
};

type OverviewPayload = {
  group_id: string;
  round: number;
  round_count: number;
  match_day: number;
  phase: string;
  round_options: RoundOption[];
  matches: HonorRoundMatchSeating[];
  tables: HonorVenueTableRow[];
  can_unlock: boolean;
};

function lockBadgeClass(status: HonorLockStatus): string {
  switch (status) {
    case "both":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "waiting":
      return "bg-amber-100 text-amber-950 border-amber-300";
    default:
      return "bg-sky-100 text-sky-950 border-sky-200";
  }
}

function isMatchLineupReady(m: HonorRoundMatchSeating): boolean {
  return (
    m.lock_status === "both" &&
    m.home_seats_complete &&
    m.away_seats_complete &&
    m.venue_tables != null
  );
}

export function HonorSeatingOverview() {
  const t = useTranslations("arbiter.honorSeating");
  const locale = useLocale() as Locale;
  const intlLocale = toIntlLocale(locale);

  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [round, setRound] = useState<number | null>(null);
  const [matchDayFilter, setMatchDayFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [downloadingBws, setDownloadingBws] = useState(false);
  const [lineupsOpen, setLineupsOpen] = useState(true);
  const [boardCount, setBoardCount] = useState(0);
  const loadGeneration = useRef(0);

  const load = useCallback(async (roundArg?: number | null) => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const qs =
        roundArg != null && roundArg > 0 ? `?round=${roundArg}` : "";
      const res = await fetch(`/api/arbiter/honor/round${qs}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? t("loadFailed"));
      }
      const data = (await res.json()) as OverviewPayload;
      if (generation !== loadGeneration.current) return;
      setPayload(data);
      setRound(data.round);
      setMatchDayFilter((prev) => prev ?? data.match_day);
    } catch (err) {
      if (generation !== loadGeneration.current) return;
      setError(err instanceof Error ? err.message : t("loadFailed"));
      setPayload(null);
    } finally {
      if (generation === loadGeneration.current) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    void load(null);
    // Initial load only — round changes call load explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roundOptions = useMemo(() => {
    const options = payload?.round_options ?? [];
    if (matchDayFilter == null) return options;
    return options.filter((o) => o.matchDay === matchDayFilter);
  }, [payload?.round_options, matchDayFilter]);

  const matchDays = useMemo(() => {
    const days = new Set(
      (payload?.round_options ?? []).map((o) => o.matchDay),
    );
    return [...days].sort((a, b) => a - b);
  }, [payload?.round_options]);

  const readyMatchCount = useMemo(
    () => payload?.matches.filter(isMatchLineupReady).length ?? 0,
    [payload?.matches],
  );

  const pendingMatches = useMemo(
    () => payload?.matches.filter((m) => !isMatchLineupReady(m)) ?? [],
    [payload?.matches],
  );

  const bwsReady =
    (payload?.matches.length ?? 0) > 0 &&
    readyMatchCount === (payload?.matches.length ?? 0);
  const boardsReady = boardCount > 0;
  const downloadReady = bwsReady && boardsReady;

  useEffect(() => {
    setBoardCount(0);
  }, [round]);

  useEffect(() => {
    if (round == null) return;
    // Keep section open while the new round's seating is still loading.
    if (loading && payload?.matches.length === 0) {
      setLineupsOpen(true);
      return;
    }
    setLineupsOpen(!bwsReady);
  }, [round, bwsReady, loading, payload?.matches.length]);

  async function onRoundChange(next: number) {
    setRound(next);
    setBoardCount(0);
    // Drop previous-round seating immediately so filters stay usable without
    // showing the wrong matches/tables while the new round loads.
    setPayload((prev) =>
      prev
        ? {
            ...prev,
            round: next,
            matches: [],
            tables: [],
          }
        : null,
    );
    await load(next);
  }

  async function unlockSide(match: HonorRoundMatchSeating, side: "home" | "away") {
    const key = `${match.match_id}:${side}`;
    setUnlocking(key);
    setError(null);
    try {
      const teamId =
        side === "home" ? match.home_team.id : match.away_team.id;
      const res = await fetch(`/api/matches/${match.match_id}/players/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? t("unlockFailed"));
      }
      await load(round);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("unlockFailed"));
    } finally {
      setUnlocking(null);
    }
  }

  function lockLabel(status: HonorLockStatus): string {
    switch (status) {
      case "both":
        return t("lockBoth");
      case "away_only":
        return t("lockAwayOnly");
      case "home_only":
        return t("lockHomeOnly");
      default:
        return t("lockWaiting");
    }
  }

  async function downloadBws() {
    const r = round ?? payload?.round;
    if (r == null || !downloadReady) return;
    setDownloadingBws(true);
    setError(null);
    try {
      const res = await fetch(`/api/arbiter/honor/bridgemate/bws?round=${r}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? t("downloadBwsFailed"));
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `honneur-ronde-${r}.bws`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("downloadBwsFailed"));
    } finally {
      setDownloadingBws(false);
    }
  }

  if (loading && !payload) {
    return <p className="text-sm text-zinc-600">{t("loading")}</p>;
  }

  if (error && !payload) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  if (!payload) {
    return <p className="text-sm text-zinc-600">{t("none")}</p>;
  }

  const matchCount = payload.matches.length;
  const phaseLabel = t("phaseLabel", {
    phase:
      payload.phase === "blind" ? t("phaseBlind") : t("phaseSequential"),
  });
  const pendingNames = pendingMatches
    .slice(0, 3)
    .map((m) => `${m.home_team.name}–${m.away_team.name}`);
  const pendingExtra = pendingMatches.length - pendingNames.length;
  const lineupsSummary = !bwsReady
    ? t("lineupsCollapsedIncomplete", {
        ready: readyMatchCount,
        count: matchCount,
      })
    : null;
  const lineupsPendingDetail =
    !bwsReady && pendingNames.length > 0
      ? t("lineupsCollapsedPending", {
          matches:
            pendingExtra > 0
              ? `${pendingNames.join(", ")} (+${pendingExtra})`
              : pendingNames.join(", "),
        })
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t("matchDay")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMatchDayFilter(null)}
              className={`rounded border px-2.5 py-1 text-sm ${
                matchDayFilter == null
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500"
              }`}
            >
              {t("allDays")}
            </button>
            {matchDays.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => {
                  setMatchDayFilter(day);
                  const first = (payload.round_options ?? []).find(
                    (o) => o.matchDay === day,
                  );
                  if (first && first.round !== round) {
                    void onRoundChange(first.round);
                  }
                }}
                className={`rounded border px-2.5 py-1 text-sm ${
                  matchDayFilter === day
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500"
                }`}
              >
                {t("dayChip", { day })}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t("round")}
          </span>
          <select
            className="min-w-[14rem] rounded border border-zinc-300 bg-white px-2 py-1.5"
            value={round ?? payload.round}
            onChange={(e) => void onRoundChange(Number(e.target.value))}
            disabled={loading}
          >
            {roundOptions.map((opt) => (
              <option key={opt.round} value={opt.round}>
                {t("roundOption", {
                  round: opt.round,
                  time: opt.slotTime,
                })}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white">
        <button
          type="button"
          aria-expanded={lineupsOpen}
          onClick={() => setLineupsOpen((open) => !open)}
          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900">
                {t("lineupsStepTitle")}
              </h2>
              <span
                className={`rounded border px-2 py-0.5 text-xs font-medium ${
                  bwsReady
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-amber-300 bg-amber-50 text-amber-950"
                }`}
              >
                {bwsReady
                  ? t("lineupsStatusReady")
                  : t("lineupsStatusWaiting", {
                      ready: readyMatchCount,
                      count: matchCount,
                    })}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-600">{phaseLabel}</p>
            {!lineupsOpen && (lineupsSummary || lineupsPendingDetail) ? (
              <div className="mt-1 space-y-0.5">
                {lineupsSummary ? (
                  <p className="text-sm font-medium text-amber-900">
                    {lineupsSummary}
                  </p>
                ) : null}
                {lineupsPendingDetail ? (
                  <p className="text-sm text-zinc-600">{lineupsPendingDetail}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <span className="shrink-0 rounded border border-zinc-300 bg-white px-2.5 py-1 text-sm text-zinc-800">
            {lineupsOpen ? t("lineupsCollapse") : t("lineupsExpand")}
          </span>
        </button>

        {lineupsOpen ? (
          <div className="space-y-6 border-t border-zinc-200 px-4 py-4">
            <div>
              <h3 className="text-base font-semibold text-zinc-900">
                {t("matchesHeading")}
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {loading && payload.matches.length === 0 ? (
                  <p className="text-sm text-zinc-600">{t("loading")}</p>
                ) : (
                  <>
                    {payload.matches.map((match) => {
                  const homeUnlockKey = `${match.match_id}:home`;
                  const awayUnlockKey = `${match.match_id}:away`;
                  const inOrder = match.lock_status === "both";
                  return (
                    <article
                      key={match.match_id}
                      className={`rounded-lg border p-4 ${
                        inOrder
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-zinc-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-zinc-900">
                            {match.home_team.name} vs {match.away_team.name}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-600">
                            {formatBrussels(match.datetime, intlLocale)}
                            {match.venue_tables
                              ? ` · ${t("tablesLabel", {
                                  open: match.venue_tables.openTable,
                                  closed: match.venue_tables.closedTable,
                                })}`
                              : null}
                          </p>
                        </div>
                        <span
                          className={`rounded border px-2 py-0.5 text-xs font-medium ${lockBadgeClass(
                            match.lock_status,
                          )}`}
                        >
                          {lockLabel(match.lock_status)}
                        </span>
                      </div>

                      <ul className="mt-3 space-y-1 text-sm text-zinc-700">
                        <li>
                          {t("sideStatus", {
                            side: t("home"),
                            status: match.home_lineup_locked_at
                              ? t("locked")
                              : match.home_seats_complete
                                ? t("draftComplete")
                                : t("notReady"),
                          })}
                        </li>
                        <li>
                          {t("sideStatus", {
                            side: t("away"),
                            status: match.away_lineup_locked_at
                              ? t("locked")
                              : match.away_seats_complete
                                ? t("draftComplete")
                                : t("notReady"),
                          })}
                        </li>
                      </ul>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/matches/${match.match_id}`}
                          className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-sm text-zinc-800 hover:border-zinc-500"
                        >
                          {t("openMatch")}
                        </Link>
                        {payload.can_unlock && match.home_lineup_locked_at ? (
                          <button
                            type="button"
                            disabled={unlocking === homeUnlockKey}
                            onClick={() => void unlockSide(match, "home")}
                            className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-sm text-zinc-800 hover:border-zinc-500 disabled:opacity-50"
                          >
                            {unlocking === homeUnlockKey
                              ? t("unlocking")
                              : t("unlockHome")}
                          </button>
                        ) : null}
                        {payload.can_unlock && match.away_lineup_locked_at ? (
                          <button
                            type="button"
                            disabled={unlocking === awayUnlockKey}
                            onClick={() => void unlockSide(match, "away")}
                            className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-sm text-zinc-800 hover:border-zinc-500 disabled:opacity-50"
                          >
                            {unlocking === awayUnlockKey
                              ? t("unlocking")
                              : t("unlockAway")}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
                    {payload.matches.length === 0 ? (
                      <p className="text-sm text-zinc-600">{t("noMatches")}</p>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-zinc-900">
                {t("tablesHeading")}
              </h3>
              <p className="mt-1 text-sm text-zinc-600">{t("tablesHint")}</p>
              {loading && payload.tables.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600">{t("loading")}</p>
              ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                      <th className="px-2 py-2 font-medium">{t("colTable")}</th>
                      <th className="px-2 py-2 font-medium">{t("colRoom")}</th>
                      <th className="px-2 py-2 font-medium">{t("colTeams")}</th>
                      <th className="px-2 py-2 font-medium">N</th>
                      <th className="px-2 py-2 font-medium">S</th>
                      <th className="px-2 py-2 font-medium">E</th>
                      <th className="px-2 py-2 font-medium">W</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.tables.map((row) => (
                      <tr
                        key={row.table}
                        className="border-b border-zinc-100 align-top"
                      >
                        <td className="px-2 py-2 font-medium text-zinc-900">
                          {row.table}
                        </td>
                        <td className="px-2 py-2 text-zinc-700">
                          {row.room === "open" ? t("roomOpen") : t("roomClosed")}
                        </td>
                        <td className="px-2 py-2 text-zinc-700">
                          {row.home_team_name && row.away_team_name
                            ? `${row.home_team_name} / ${row.away_team_name}`
                            : "—"}
                        </td>
                        {(["N", "S", "E", "W"] as const).map((dir) => {
                          const seat = row.seats.find((s) => s.direction === dir);
                          const muted = seat?.player_id && !seat.side_locked;
                          return (
                            <td
                              key={dir}
                              className={`px-2 py-2 ${
                                muted ? "text-zinc-400" : "text-zinc-900"
                              }`}
                            >
                              {seat?.name ? (
                                <span>
                                  {seat.name}
                                  {muted ? (
                                    <span className="ml-1 text-[10px] uppercase">
                                      {t("draftMark")}
                                    </span>
                                  ) : null}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <HonorButlerWorkflow
        round={round}
        enabled={round != null && !!payload}
        onBoardCountChange={setBoardCount}
      >
        <HonorPbnUploadStep />

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900">
                {t("bwsStepTitle")}
              </p>
              <p className="mt-0.5 text-xs text-zinc-600">
                {!bwsReady
                  ? t("downloadBwsNotReady")
                  : !boardsReady
                    ? t("downloadBwsNoBoards")
                    : t("downloadBwsHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void downloadBws()}
              disabled={!downloadReady || downloadingBws || loading}
              className="shrink-0 rounded border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-300"
            >
              {downloadingBws ? t("downloadingBws") : t("downloadBws")}
            </button>
          </div>
        </div>

        <HonorBwsUploadStep />

        <HonorBoardResultsEditor
          round={round}
          enabled={round != null && !!payload}
        />

        <HonorPublishStep />
      </HonorButlerWorkflow>
    </div>
  );
}
