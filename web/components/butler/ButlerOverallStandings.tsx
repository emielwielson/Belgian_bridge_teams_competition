"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { filterStandingsByMinRounds } from "@/lib/butler/filter-standings";
import { formatImps } from "@/lib/butler/format";
import { formatPairDisplayName } from "@/lib/butler/person-name";
import type {
  PublicCombinationStandingRow,
  PublicPlayerStandingRow,
} from "@/lib/butler/public-standings";

function MinMatchesFilter({
  minMatches,
  maxRounds,
  onChange,
}: {
  minMatches: number;
  maxRounds: number;
  onChange: (value: number) => void;
}) {
  const t = useTranslations("butler");
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600">
      <span>{t("minMatches")}</span>
      <input
        type="number"
        min={1}
        max={maxRounds}
        value={minMatches}
        onChange={(e) => {
          const raw = Number(e.target.value);
          if (!Number.isFinite(raw)) {
            onChange(1);
            return;
          }
          onChange(Math.min(maxRounds, Math.max(1, Math.floor(raw))));
        }}
        className="w-16 rounded border border-zinc-300 px-2 py-1 text-right tabular-nums text-zinc-900"
      />
    </label>
  );
}

function StandingsShell({
  minMatches,
  maxRounds,
  onMinMatchesChange,
  children,
}: {
  minMatches: number;
  maxRounds: number;
  onMinMatchesChange: (value: number) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <MinMatchesFilter
        minMatches={minMatches}
        maxRounds={maxRounds}
        onChange={onMinMatchesChange}
      />
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        {children}
      </div>
    </div>
  );
}

export function ButlerOverallStandings({
  combinations,
  maxRounds,
}: {
  combinations: PublicCombinationStandingRow[];
  maxRounds: number;
}) {
  const t = useTranslations("butler");
  const [minMatches, setMinMatches] = useState(1);
  const rows = filterStandingsByMinRounds(combinations, minMatches);

  return (
    <StandingsShell
      minMatches={minMatches}
      maxRounds={maxRounds}
      onMinMatchesChange={setMinMatches}
    >
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-500">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 font-medium">
              {t("rank")}
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">
              {t("pair")}
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">
              {t("team")}
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
              {t("imps")}
            </th>
            <th className="hidden whitespace-nowrap px-3 py-2 text-right font-medium sm:table-cell">
              {t("matches")}
            </th>
            <th className="hidden whitespace-nowrap px-3 py-2 text-right font-medium sm:table-cell">
              {t("boards")}
            </th>
            <th className="hidden whitespace-nowrap px-3 py-2 text-right font-medium md:table-cell">
              {t("avg")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row, index) => {
            const stripe = index % 2 === 1 ? "bg-zinc-50" : "bg-white";
            return (
              <tr
                key={row.combinationId}
                className="hover:[&>td]:bg-zinc-100/80"
              >
                <td
                  className={`px-3 py-2 tabular-nums text-zinc-500 ${stripe}`}
                >
                  {row.rank}
                </td>
                <td className={`px-3 py-2 ${stripe}`}>
                  <Link
                    href={`/butler/pairs/${row.combinationId}`}
                    className="link-inline"
                  >
                    {formatPairDisplayName(row.displayName)}
                  </Link>
                </td>
                <td className={`px-3 py-2 text-zinc-600 ${stripe}`}>
                  {row.teamName}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${stripe}`}
                >
                  {formatImps(row.totalImps)}
                </td>
                <td
                  className={`hidden px-3 py-2 text-right tabular-nums text-zinc-500 sm:table-cell ${stripe}`}
                >
                  {row.roundsPlayed}
                </td>
                <td
                  className={`hidden px-3 py-2 text-right tabular-nums text-zinc-500 sm:table-cell ${stripe}`}
                >
                  {row.boardsPlayed}
                </td>
                <td
                  className={`hidden px-3 py-2 text-right font-mono tabular-nums text-zinc-500 md:table-cell ${stripe}`}
                >
                  {formatImps(row.averageImps)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </StandingsShell>
  );
}

export function ButlerOverallPlayerStandings({
  players,
  maxRounds,
}: {
  players: PublicPlayerStandingRow[];
  maxRounds: number;
}) {
  const t = useTranslations("butler");
  const [minMatches, setMinMatches] = useState(1);
  const rows = filterStandingsByMinRounds(players, minMatches);

  return (
    <StandingsShell
      minMatches={minMatches}
      maxRounds={maxRounds}
      onMinMatchesChange={setMinMatches}
    >
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-500">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 font-medium">
              {t("rank")}
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">
              {t("player")}
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">
              {t("team")}
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
              {t("imps")}
            </th>
            <th className="hidden whitespace-nowrap px-3 py-2 text-right font-medium sm:table-cell">
              {t("matches")}
            </th>
            <th className="hidden whitespace-nowrap px-3 py-2 text-right font-medium sm:table-cell">
              {t("boards")}
            </th>
            <th className="hidden whitespace-nowrap px-3 py-2 text-right font-medium md:table-cell">
              {t("avg")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row, index) => {
            const stripe = index % 2 === 1 ? "bg-zinc-50" : "bg-white";
            return (
              <tr key={row.playerId} className="hover:[&>td]:bg-zinc-100/80">
                <td
                  className={`px-3 py-2 tabular-nums text-zinc-500 ${stripe}`}
                >
                  {row.rank}
                </td>
                <td className={`px-3 py-2 ${stripe}`}>{row.displayName}</td>
                <td className={`px-3 py-2 text-zinc-600 ${stripe}`}>
                  {row.teamName}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${stripe}`}
                >
                  {formatImps(row.totalImps)}
                </td>
                <td
                  className={`hidden px-3 py-2 text-right tabular-nums text-zinc-500 sm:table-cell ${stripe}`}
                >
                  {row.roundsPlayed}
                </td>
                <td
                  className={`hidden px-3 py-2 text-right tabular-nums text-zinc-500 sm:table-cell ${stripe}`}
                >
                  {row.boardsPlayed}
                </td>
                <td
                  className={`hidden px-3 py-2 text-right font-mono tabular-nums text-zinc-500 md:table-cell ${stripe}`}
                >
                  {formatImps(row.averageImps)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </StandingsShell>
  );
}
