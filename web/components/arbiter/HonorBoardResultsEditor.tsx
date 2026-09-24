"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { formatContract } from "@/lib/butler/format";
import { computeWeightedScores, parseAveragePmAwards } from "@/lib/results/adjustment-helpers";
import { formatAveragePmScoreCell } from "@/lib/results/average-pm-labels";
import type { AverageAward, NonOffendingSide } from "@/lib/results/types";
import {
  parseWeightedMatchMeta,
  weightedMatchImpsFromLegs,
} from "@/lib/scoring/weighted-match-imps";
import { effectiveNsScoreForDatum } from "@/lib/butler/special-results";

export type HonorResultRow = {
  id: string;
  match_id: string;
  match_label: string;
  room: string;
  table_number: number | null;
  players: { direction: string; name: string }[];
  board_id: string;
  board_number: number | null;
  contract_level: number | null;
  contract_denomination: string | null;
  doubling: string | null;
  declarer: string | null;
  tricks_result: string | null;
  tricks_taken: number | null;
  ns_score: number | null;
  computed_score: number | null;
  ns_butler_imps: number | null;
  ew_butler_imps: number | null;
  validation_status: string;
  special_result_kind: string;
  correction_status: string;
  included_in_datum: boolean;
  included_in_match_score: boolean;
  datum_eligible: boolean | null;
  admin_adjusted_ns_score: number | null;
  admin_adjusted_ew_score: number | null;
  admin_ns_butler_imps: number | null;
  admin_ew_butler_imps: number | null;
  adjustment_mode: string | null;
  adjustment_meta: Record<string, unknown> | null;
};

type Mode = "cancelled" | "weighted" | "average_pm" | "correct";
type PickBy = "match" | "table";

const MODES: readonly Mode[] = ["cancelled", "weighted", "average_pm", "correct"];

function isMode(value: string): value is Mode {
  return (MODES as readonly string[]).includes(value);
}

type WeightedLegForm = {
  score: string;
  weightNs: string;
  weightEw: string;
};

function emptyLeg(): WeightedLegForm {
  return { score: "", weightNs: "1", weightEw: "1" };
}

function awardSelectValue(award: AverageAward | null): string {
  return award ?? "none";
}

function parseAwardSelect(value: string): AverageAward | null {
  if (value === "plus" || value === "minus" || value === "zero") return value;
  return null;
}

function isAdjustedResult(row: HonorResultRow): boolean {
  return (
    row.correction_status === "corrected" ||
    (row.adjustment_mode != null && row.adjustment_mode !== "")
  );
}

function pairNames(
  players: { direction: string; name: string }[],
  a: string,
  b: string,
): string | null {
  const byDir = new Map(players.map((p) => [p.direction, p.name]));
  const left = byDir.get(a);
  const right = byDir.get(b);
  if (!left && !right) return null;
  return `${left ?? "—"} – ${right ?? "—"}`;
}

/** Bridgemate-style relative results valid for contract level 1–7. */
function tricksResultOptionsForLevel(level: number): string[] {
  if (!Number.isInteger(level) || level < 1 || level > 7) return ["="];
  const maxOver = 7 - level;
  const maxDown = 6 + level;
  const options = ["="];
  for (let i = 1; i <= maxOver; i++) options.push(`+${i}`);
  for (let i = 1; i <= maxDown; i++) options.push(`-${i}`);
  return options;
}
export function HonorBoardResultsEditor({
  round,
  enabled,
  refreshKey = 0,
}: {
  round: number | null;
  enabled: boolean;
  /** Bump after import/publish to reload the list. */
  refreshKey?: number;
}) {
  const t = useTranslations("arbiter.honorResults");
  const [rows, setRows] = useState<HonorResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickBy, setPickBy] = useState<PickBy>("match");
  const [matchId, setMatchId] = useState("");
  const [room, setRoom] = useState<"open" | "closed" | "">("");
  const [tableNumber, setTableNumber] = useState("");
  const [boardNumber, setBoardNumber] = useState("");
  const [mode, setMode] = useState<Mode>("weighted");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadGeneration = useRef(0);

  // Shared form fields
  const [reason, setReason] = useState("");
  const [datumEligible, setDatumEligible] = useState(true);
  const [weightedLegs, setWeightedLegs] = useState<WeightedLegForm[]>([
    emptyLeg(),
  ]);
  const [nonOffendingSide, setNonOffendingSide] =
    useState<NonOffendingSide>("ns");
  const [overrideHomeImps, setOverrideHomeImps] = useState("");
  const [overrideAwayImps, setOverrideAwayImps] = useState("");
  const [nsAward, setNsAward] = useState<AverageAward | null>(null);
  const [ewAward, setEwAward] = useState<AverageAward | null>(null);
  const [contractLevel, setContractLevel] = useState("");
  const [contractDenom, setContractDenom] = useState("NT");
  const [doubling, setDoubling] = useState("NONE");
  const [declarer, setDeclarer] = useState("N");
  const [tricksResult, setTricksResult] = useState("=");
  const [nsScoreOverride, setNsScoreOverride] = useState("");

  const selected = useMemo(() => {
    if (boardNumber === "") return null;
    const bn = Number(boardNumber);
    if (pickBy === "match") {
      if (!matchId || !room) return null;
      return (
        rows.find(
          (r) =>
            r.match_id === matchId &&
            r.room === room &&
            r.board_number === bn,
        ) ?? null
      );
    }
    const tn = Number(tableNumber);
    if (!Number.isFinite(tn)) return null;
    return (
      rows.find(
        (r) => r.table_number === tn && r.board_number === bn,
      ) ?? null
    );
  }, [rows, pickBy, matchId, room, tableNumber, boardNumber]);

  const matchOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!map.has(r.match_id)) map.set(r.match_id, r.match_label);
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const roomOptions = useMemo(() => {
    if (!matchId) return [] as Array<"open" | "closed">;
    const rooms = new Set<"open" | "closed">();
    for (const r of rows) {
      if (r.match_id === matchId && (r.room === "open" || r.room === "closed")) {
        rooms.add(r.room);
      }
    }
    return [...rooms].sort();
  }, [rows, matchId]);

  const tableOptions = useMemo(() => {
    const nums = new Set<number>();
    for (const r of rows) {
      if (r.table_number != null) nums.add(r.table_number);
    }
    return [...nums].sort((a, b) => a - b);
  }, [rows]);

  const boardOptions = useMemo(() => {
    let scoped = rows;
    if (pickBy === "match") {
      if (!matchId || !room) return [] as number[];
      scoped = rows.filter((r) => r.match_id === matchId && r.room === room);
    } else {
      const tn = Number(tableNumber);
      if (!Number.isFinite(tn)) return [] as number[];
      scoped = rows.filter((r) => r.table_number === tn);
    }
    const nums = new Set<number>();
    for (const r of scoped) {
      if (r.board_number != null) nums.add(r.board_number);
    }
    return [...nums].sort((a, b) => a - b);
  }, [rows, pickBy, matchId, room, tableNumber]);

  const adjustedRows = useMemo(
    () =>
      rows
        .filter(isAdjustedResult)
        .sort((a, b) => {
          const tn = (a.table_number ?? 99) - (b.table_number ?? 99);
          if (tn !== 0) return tn;
          return (a.board_number ?? 0) - (b.board_number ?? 0);
        }),
    [rows],
  );

  const load = useCallback(async () => {
    if (round == null || !enabled) return;
    const generation = ++loadGeneration.current;
    setLoading(true);
    setRows([]);
    setError(null);
    try {
      const res = await fetch(
        `/api/arbiter/honor/rounds/${round}/results?filter=all`,
      );
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        results?: HonorResultRow[];
      } | null;
      if (!res.ok) throw new Error(body?.error ?? t("loadFailed"));
      if (generation !== loadGeneration.current) return;
      setRows(body?.results ?? []);
    } catch (err) {
      if (generation !== loadGeneration.current) return;
      setError(err instanceof Error ? err.message : t("loadFailed"));
      setRows([]);
    } finally {
      if (generation === loadGeneration.current) {
        setLoading(false);
      }
    }
  }, [round, enabled, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    setRows([]);
    setLoading(true);
    setMatchId("");
    setRoom("");
    setTableNumber("");
    setBoardNumber("");
    setMessage(null);
    setError(null);
  }, [round]);

  function selectResult(row: HonorResultRow) {
    setPickBy("match");
    setMatchId(row.match_id);
    setRoom(row.room === "closed" ? "closed" : "open");
    setTableNumber(
      row.table_number != null ? String(row.table_number) : "",
    );
    setBoardNumber(
      row.board_number != null ? String(row.board_number) : "",
    );
    setMessage(null);
    setError(null);
  }

  function adjustmentModeLabel(row: HonorResultRow): string {
    switch (row.adjustment_mode) {
      case "cancelled":
        return t("modeCancelled");
      case "artificial":
        return t("modeArtificialLegacy");
      case "split":
        return t("modeSplit");
      case "weighted":
        return t("modeWeighted");
      case "average_pm":
        return t("modeAveragePm");
      case "correction":
        return t("modeCorrect");
      default:
        return t("adjustedGeneric");
    }
  }

  useEffect(() => {
    if (!selected) return;
    setDatumEligible(selected.datum_eligible !== false);
    setWeightedLegs([emptyLeg()]);
    setNonOffendingSide("ns");
    setOverrideHomeImps("");
    setOverrideAwayImps("");
    const awards = parseAveragePmAwards(selected.adjustment_meta);
    setNsAward(awards.nsAward);
    setEwAward(awards.ewAward);
    setContractLevel(
      selected.contract_level != null ? String(selected.contract_level) : "",
    );
    setContractDenom(selected.contract_denomination ?? "NT");
    setDoubling(selected.doubling ?? "NONE");
    setDeclarer(selected.declarer ?? "N");
    setTricksResult(selected.tricks_result ?? "=");
    setNsScoreOverride("");
    setReason("");
    if (selected.adjustment_mode === "cancelled") {
      setMode("cancelled");
    } else if (selected.adjustment_mode === "weighted") {
      setMode("weighted");
      const weighted = parseWeightedMatchMeta(selected.adjustment_meta);
      if (weighted.legs) {
        setWeightedLegs(
          weighted.legs.map((leg) => ({
            score: String(leg.score),
            weightNs: String(leg.weightNs),
            weightEw: String(leg.weightEw),
          })),
        );
      }
      if (weighted.nonOffendingSide) {
        setNonOffendingSide(weighted.nonOffendingSide);
      }
      if (weighted.matchImpsOverride) {
        setOverrideHomeImps(String(weighted.matchImpsOverride.homeImps));
        setOverrideAwayImps(String(weighted.matchImpsOverride.awayImps));
      }
    } else if (selected.adjustment_mode === "average_pm") {
      setMode("average_pm");
    } else if (selected.adjustment_mode === "correction") {
      setMode("correct");
    } else if (
      selected.special_result_kind === "not_played" ||
      selected.special_result_kind === "erased"
    ) {
      setMode("cancelled");
    } else if (
      selected.validation_status === "special" ||
      selected.adjustment_mode === "artificial" ||
      selected.adjustment_mode === "split"
    ) {
      // Legacy split/artificial: re-enter via weighted
      setMode("weighted");
    } else {
      setMode("weighted");
    }
  }, [selected]);

  const weightedPreview = useMemo(() => {
    const legs = weightedLegs.map((leg) => ({
      score: Number(leg.score),
      weightNs: Number(leg.weightNs),
      weightEw: Number(leg.weightEw),
    }));
    if (
      legs.length < 1 ||
      !legs.every(
        (leg) =>
          Number.isFinite(leg.score) &&
          leg.weightNs > 0 &&
          leg.weightEw > 0,
      )
    ) {
      return null;
    }
    try {
      return computeWeightedScores({ legs });
    } catch {
      return null;
    }
  }, [weightedLegs]);

  const otherRoomResult = useMemo(() => {
    if (!selected) return null;
    const otherRoom = selected.room === "open" ? "closed" : "open";
    const other = rows.find(
      (r) =>
        r.match_id === selected.match_id &&
        r.board_id === selected.board_id &&
        r.room === otherRoom,
    );
    if (!other) return null;

    const contract = formatContract({
      contractLevel: other.contract_level,
      contractDenomination: other.contract_denomination,
      doubling: other.doubling ?? "NONE",
      declarer: other.declarer,
      tricksResult: other.tricks_result,
    });
    const nsPlayers = pairNames(other.players ?? [], "N", "S");
    const ewPlayers = pairNames(other.players ?? [], "E", "W");

    if (other.adjustment_mode === "weighted") {
      const meta = parseWeightedMatchMeta(other.adjustment_meta);
      if (meta.legs) {
        return {
          kind: "weighted" as const,
          room: otherRoom,
          tableNumber: other.table_number,
          legs: meta.legs,
          nop: meta.nonOffendingSide,
          nsScore:
            other.admin_adjusted_ns_score ??
            effectiveNsScoreForDatum({
              adminAdjustedNsScore: other.admin_adjusted_ns_score,
              nsScore: other.ns_score,
              computedScore: other.computed_score,
            }),
          contract,
          nsPlayers,
          ewPlayers,
        };
      }
    }
    if (other.adjustment_mode === "average_pm") {
      return {
        kind: "average_pm" as const,
        room: otherRoom,
        tableNumber: other.table_number,
        scoreLabel:
          formatAveragePmScoreCell(other.adjustment_meta, {
            plus: t("averageAwardPlus"),
            minus: t("averageAwardMinus"),
            zero: t("averageAwardZero"),
          }) ?? t("modeAveragePm"),
        contract,
        nsPlayers,
        ewPlayers,
      };
    }
    const ns = effectiveNsScoreForDatum({
      adminAdjustedNsScore: other.admin_adjusted_ns_score,
      nsScore: other.ns_score,
      computedScore: other.computed_score,
    });
    if (ns == null) {
      return {
        kind: "missing" as const,
        room: otherRoom,
        tableNumber: other.table_number,
        contract,
        nsPlayers,
        ewPlayers,
      };
    }
    return {
      kind: "fixed" as const,
      room: otherRoom,
      tableNumber: other.table_number,
      nsScore: ns,
      legs: null as null,
      nop: null as null,
      contract,
      nsPlayers,
      ewPlayers,
    };
  }, [selected, rows, t]);

  const weightedMatchImpsPreview = useMemo(() => {
    if (overrideHomeImps !== "" || overrideAwayImps !== "") {
      const homeImps = Number(overrideHomeImps);
      const awayImps = Number(overrideAwayImps);
      if (
        Number.isInteger(homeImps) &&
        Number.isInteger(awayImps) &&
        overrideHomeImps !== "" &&
        overrideAwayImps !== ""
      ) {
        return { homeImps, awayImps, source: "override" as const };
      }
      return null;
    }
    const legs = weightedLegs.map((leg) => ({
      score: Number(leg.score),
      weightNs: Number(leg.weightNs),
      weightEw: Number(leg.weightEw),
    }));
    if (
      legs.length < 1 ||
      !legs.every(
        (leg) =>
          Number.isFinite(leg.score) &&
          leg.weightNs > 0 &&
          leg.weightEw > 0,
      ) ||
      !otherRoomResult ||
      (otherRoomResult.kind !== "fixed" && otherRoomResult.kind !== "weighted") ||
      !selected
    ) {
      return null;
    }
    try {
      const thisSide = {
        legs,
        nonOffendingSide,
      };
      const otherSide =
        otherRoomResult.kind === "weighted"
          ? {
              legs: otherRoomResult.legs,
              nonOffendingSide: otherRoomResult.nop,
            }
          : { nsScore: otherRoomResult.nsScore };
      const open = selected.room === "open" ? thisSide : otherSide;
      const closed = selected.room === "closed" ? thisSide : otherSide;
      const result = weightedMatchImpsFromLegs({ open, closed });
      return {
        homeImps: result.homeImps,
        awayImps: result.awayImps,
        source: "auto" as const,
      };
    } catch {
      return null;
    }
  }, [
    weightedLegs,
    nonOffendingSide,
    otherRoomResult,
    selected,
    overrideHomeImps,
    overrideAwayImps,
  ]);

  const selectedScoreLabel = useMemo(() => {
    if (!selected) return "—";
    if (selected.adjustment_mode === "average_pm") {
      return (
        formatAveragePmScoreCell(selected.adjustment_meta, {
          plus: t("averageAwardPlus"),
          minus: t("averageAwardMinus"),
          zero: t("averageAwardZero"),
        }) ?? t("modeAveragePm")
      );
    }
    return (
      selected.admin_adjusted_ns_score ?? selected.ns_score ?? "—"
    );
  }, [selected, t]);

  const selectedContractLabel = useMemo(() => {
    if (!selected) return "—";
    return formatContract({
      contractLevel: selected.contract_level,
      contractDenomination: selected.contract_denomination,
      doubling: selected.doubling ?? "NONE",
      declarer: selected.declarer,
      tricksResult: selected.tricks_result,
    });
  }, [selected]);

  const selectedPlayersLabel = useMemo(() => {
    if (!selected) return null;
    const ns = pairNames(selected.players ?? [], "N", "S");
    const ew = pairNames(selected.players ?? [], "E", "W");
    if (!ns && !ew) return null;
    return t("selectedPlayers", {
      ns: ns ?? "—",
      ew: ew ?? "—",
    });
  }, [selected, t]);

  const tricksResultOptions = useMemo(() => {
    if (contractDenom === "PASS") return ["PASS"];
    const level = Number(contractLevel);
    return tricksResultOptionsForLevel(level);
  }, [contractDenom, contractLevel]);

  useEffect(() => {
    if (contractDenom === "PASS") {
      if (tricksResult !== "PASS") setTricksResult("PASS");
      return;
    }
    if (!tricksResultOptions.includes(tricksResult)) {
      setTricksResult(tricksResultOptions[0] ?? "=");
    }
  }, [contractDenom, tricksResult, tricksResultOptions]);

  async function save() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (mode === "correct") {
        const res = await fetch(`/api/arbiter/honor/results/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractLevel: contractLevel === "" ? null : Number(contractLevel),
            contractDenomination: contractDenom,
            doubling,
            declarer,
            tricksResult,
            nsScore: nsScoreOverride === "" ? undefined : Number(nsScoreOverride),
            reason: reason || null,
          }),
        });
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          matchScores?: { refreshed?: boolean };
        } | null;
        if (!res.ok) throw new Error(body?.error ?? t("saveFailed"));
        setMessage(
          body?.matchScores?.refreshed
            ? t("saveSuccessMatchScores")
            : t("saveSuccess"),
        );
      } else {
        const payload: Record<string, unknown> = {
          mode,
          reason: reason || null,
        };
        if (mode === "weighted") {
          payload.legs = weightedLegs.map((leg) => ({
            score: Number(leg.score),
            weightNs: Number(leg.weightNs),
            weightEw: Number(leg.weightEw),
          }));
          payload.nonOffendingSide = nonOffendingSide;
          payload.datumEligible = datumEligible;
          if (overrideHomeImps !== "" || overrideAwayImps !== "") {
            payload.matchImpsOverride = {
              homeImps: Number(overrideHomeImps),
              awayImps: Number(overrideAwayImps),
            };
          }
        }
        if (mode === "average_pm") {
          payload.nsAward = nsAward;
          payload.ewAward = ewAward;
        }

        const res = await fetch(
          `/api/arbiter/honor/results/${selected.id}/resolve-special`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          matchScores?: { refreshed?: boolean };
        } | null;
        if (!res.ok) throw new Error(body?.error ?? t("saveFailed"));
        setMessage(
          body?.matchScores?.refreshed
            ? t("saveSuccessMatchScores")
            : t("saveSuccess"),
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!enabled || round == null) return null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-zinc-600">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">{t("empty")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setPickBy("match");
                setTableNumber("");
                setBoardNumber("");
              }}
              className={
                pickBy === "match"
                  ? "rounded border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm text-white"
                  : "rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800"
              }
            >
              {t("pickByMatch")}
            </button>
            <button
              type="button"
              onClick={() => {
                setPickBy("table");
                setMatchId("");
                setRoom("");
                setBoardNumber("");
              }}
              className={
                pickBy === "table"
                  ? "rounded border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm text-white"
                  : "rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800"
              }
            >
              {t("pickByTable")}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {pickBy === "match" ? (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600">{t("selectMatch")}</span>
                  <select
                    value={matchId}
                    onChange={(e) => {
                      setMatchId(e.target.value);
                      setRoom("");
                      setBoardNumber("");
                    }}
                    className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  >
                    <option value="">{t("selectPlaceholder")}</option>
                    {matchOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600">{t("selectRoom")}</span>
                  <select
                    value={room}
                    onChange={(e) => {
                      setRoom(e.target.value as "open" | "closed" | "");
                      setBoardNumber("");
                    }}
                    disabled={!matchId}
                    className="rounded border border-zinc-300 bg-white px-2 py-1.5 disabled:opacity-50"
                  >
                    <option value="">{t("selectPlaceholder")}</option>
                    {roomOptions.map((r) => (
                      <option key={r} value={r}>
                        {r === "open" ? t("roomOpen") : t("roomClosed")}
                        {(() => {
                          const tn = rows.find(
                            (row) =>
                              row.match_id === matchId && row.room === r,
                          )?.table_number;
                          return tn != null
                            ? ` (${t("tableShort", { table: tn })})`
                            : "";
                        })()}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-zinc-600">{t("selectTable")}</span>
                <select
                  value={tableNumber}
                  onChange={(e) => {
                    setTableNumber(e.target.value);
                    setBoardNumber("");
                  }}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                >
                  <option value="">{t("selectPlaceholder")}</option>
                  {tableOptions.map((tn) => {
                    const sample = rows.find((r) => r.table_number === tn);
                    return (
                      <option key={tn} value={String(tn)}>
                        {t("tableOption", {
                          table: tn,
                          match: sample?.match_label ?? "?",
                          room:
                            sample?.room === "open"
                              ? t("roomOpen")
                              : t("roomClosed"),
                        })}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600">{t("selectBoard")}</span>
              <select
                value={boardNumber}
                onChange={(e) => setBoardNumber(e.target.value)}
                disabled={boardOptions.length === 0}
                className="rounded border border-zinc-300 bg-white px-2 py-1.5 disabled:opacity-50"
              >
                <option value="">{t("selectPlaceholder")}</option>
                {boardOptions.map((bn) => {
                  const row =
                    pickBy === "match"
                      ? rows.find(
                          (r) =>
                            r.match_id === matchId &&
                            r.room === room &&
                            r.board_number === bn,
                        )
                      : rows.find(
                          (r) =>
                            r.table_number === Number(tableNumber) &&
                            r.board_number === bn,
                        );
                  const adjusted = row ? isAdjustedResult(row) : false;
                  return (
                    <option key={bn} value={String(bn)}>
                      {adjusted
                        ? t("boardOptionAdjusted", { board: bn })
                        : t("boardOption", { board: bn })}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          {adjustedRows.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2">
              <p className="text-sm font-medium text-amber-950">
                {t("adjustedHeading", { count: adjustedRows.length })}
              </p>
              <ul className="mt-2 space-y-1">
                {adjustedRows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => selectResult(row)}
                      className="text-left text-sm text-amber-950 underline-offset-2 hover:underline"
                    >
                      {t("adjustedItem", {
                        table: row.table_number ?? "—",
                        board: row.board_number ?? "—",
                        match: row.match_label,
                        room:
                          row.room === "open" ? t("roomOpen") : t("roomClosed"),
                        mode: adjustmentModeLabel(row),
                      })}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {selected ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">
            {t("editTitle", {
              board: selected.board_number ?? "?",
              room: selected.room,
              match: selected.match_label,
            })}
          </h3>
          <p className="mt-1 text-xs text-zinc-600">
            {selected.table_number != null
              ? t("selectedMeta", {
                  table: selected.table_number,
                  contract: selectedContractLabel,
                  score: selectedScoreLabel,
                })
              : t("selectedMetaNoTable", {
                  contract: selectedContractLabel,
                  score: selectedScoreLabel,
                })}
          </p>
          <p className="mt-1 text-xs text-zinc-700">
            {selectedPlayersLabel ?? t("selectedPlayersMissing")}
          </p>

          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">{t("mode")}</span>
            <select
              value={isMode(mode) ? mode : "weighted"}
              onChange={(e) => {
                const next = e.target.value;
                setMode(isMode(next) ? next : "weighted");
              }}
              className="rounded border border-zinc-300 bg-white px-2 py-1.5"
              disabled={busy}
            >
              <option value="cancelled">{t("modeCancelled")}</option>
              <option value="average_pm">{t("modeAveragePm")}</option>
              <option value="weighted">{t("modeWeighted")}</option>
              <option value="correct">{t("modeCorrect")}</option>
            </select>
          </label>

          <p className="mt-2 text-xs text-zinc-600">
            {t(`modeHelp_${isMode(mode) ? mode : "weighted"}`)}
          </p>

          {mode === "average_pm" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("averageAwardNs")}</span>
                <select
                  value={awardSelectValue(nsAward)}
                  onChange={(e) => setNsAward(parseAwardSelect(e.target.value))}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy}
                >
                  <option value="none">{t("averageAwardNone")}</option>
                  <option value="plus">{t("averageAwardPlus")}</option>
                  <option value="zero">{t("averageAwardZero")}</option>
                  <option value="minus">{t("averageAwardMinus")}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("averageAwardEw")}</span>
                <select
                  value={awardSelectValue(ewAward)}
                  onChange={(e) => setEwAward(parseAwardSelect(e.target.value))}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy}
                >
                  <option value="none">{t("averageAwardNone")}</option>
                  <option value="plus">{t("averageAwardPlus")}</option>
                  <option value="zero">{t("averageAwardZero")}</option>
                  <option value="minus">{t("averageAwardMinus")}</option>
                </select>
              </label>
            </div>
          ) : null}

          {mode === "weighted" ? (
            <div className="mt-3 space-y-3">
              <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
                <p className="font-medium">{t("otherTableTitle")}</p>
                {otherRoomResult == null ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("otherTableMissing")}
                  </p>
                ) : (
                  <div className="mt-1 space-y-0.5 text-xs text-zinc-700">
                    <p>
                      {t("otherTableRoom", {
                        room:
                          otherRoomResult.room === "open"
                            ? t("roomOpen")
                            : t("roomClosed"),
                        table:
                          otherRoomResult.tableNumber != null
                            ? String(otherRoomResult.tableNumber)
                            : "—",
                      })}
                    </p>
                    {otherRoomResult.nsPlayers || otherRoomResult.ewPlayers ? (
                      <p>
                        {t("otherTablePlayers", {
                          ns: otherRoomResult.nsPlayers ?? "—",
                          ew: otherRoomResult.ewPlayers ?? "—",
                        })}
                      </p>
                    ) : null}
                    {otherRoomResult.contract ? (
                      <p>
                        {t("otherTableContract", {
                          contract: otherRoomResult.contract,
                        })}
                      </p>
                    ) : null}
                    {otherRoomResult.kind === "fixed" ||
                    otherRoomResult.kind === "weighted" ? (
                      <p className="font-medium text-zinc-900">
                        {t("otherTableNsScore", {
                          score:
                            otherRoomResult.nsScore != null
                              ? String(otherRoomResult.nsScore)
                              : "—",
                        })}
                      </p>
                    ) : otherRoomResult.kind === "average_pm" ? (
                      <p className="font-medium text-zinc-900">
                        {t("otherTableScoreLabel", {
                          score: otherRoomResult.scoreLabel,
                        })}
                      </p>
                    ) : (
                      <p className="text-zinc-500">{t("otherTableNoScore")}</p>
                    )}
                    {otherRoomResult.kind === "weighted" ? (
                      <p className="text-zinc-600">
                        {t("otherTableWeightedLegs", {
                          detail: otherRoomResult.legs
                            .map(
                              (leg) =>
                                `${leg.score} (NZ ${leg.weightNs}/OW ${leg.weightEw})`,
                            )
                            .join(" · "),
                        })}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-600">{t("weightedWeightsHelp")}</p>
              {weightedLegs.map((leg, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded border border-zinc-200 bg-white px-3 py-3 sm:grid-cols-4"
                >
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-zinc-600">
                      {t("legScore", { n: index + 1 })}
                    </span>
                    <input
                      type="number"
                      value={leg.score}
                      onChange={(e) => {
                        const next = [...weightedLegs];
                        next[index] = { ...leg, score: e.target.value };
                        setWeightedLegs(next);
                      }}
                      className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                      disabled={busy}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-zinc-600">{t("legWeightNs")}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={leg.weightNs}
                      onChange={(e) => {
                        const next = [...weightedLegs];
                        next[index] = { ...leg, weightNs: e.target.value };
                        setWeightedLegs(next);
                      }}
                      className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                      disabled={busy}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-zinc-600">{t("legWeightEw")}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={leg.weightEw}
                      onChange={(e) => {
                        const next = [...weightedLegs];
                        next[index] = { ...leg, weightEw: e.target.value };
                        setWeightedLegs(next);
                      }}
                      className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                      disabled={busy}
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        setWeightedLegs((prev) =>
                          prev.length <= 1
                            ? prev
                            : prev.filter((_, i) => i !== index),
                        )
                      }
                      disabled={busy || weightedLegs.length <= 1}
                      className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700 disabled:opacity-40"
                    >
                      {t("removeLeg")}
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setWeightedLegs((prev) => [...prev, emptyLeg()])}
                disabled={busy}
                className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800"
              >
                {t("addLeg")}
              </button>
              <p className="text-sm text-zinc-700">
                {t("weightedPreview", {
                  ns: weightedPreview?.computedNs ?? "—",
                  ew: weightedPreview?.computedEw ?? "—",
                })}
              </p>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-zinc-800">
                  {t("nonOffendingSide")}
                </legend>
                <p className="text-xs text-zinc-600">{t("nonOffendingSideHelp")}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="nonOffendingSide"
                      checked={nonOffendingSide === "ns"}
                      onChange={() => setNonOffendingSide("ns")}
                      disabled={busy}
                    />
                    {t("nonOffendingNs")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="nonOffendingSide"
                      checked={nonOffendingSide === "ew"}
                      onChange={() => setNonOffendingSide("ew")}
                      disabled={busy}
                    />
                    {t("nonOffendingEw")}
                  </label>
                </div>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600">{t("overrideHomeImps")}</span>
                  <input
                    type="number"
                    step="1"
                    value={overrideHomeImps}
                    onChange={(e) => setOverrideHomeImps(e.target.value)}
                    placeholder={t("overrideImpsOptional")}
                    className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                    disabled={busy}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600">{t("overrideAwayImps")}</span>
                  <input
                    type="number"
                    step="1"
                    value={overrideAwayImps}
                    onChange={(e) => setOverrideAwayImps(e.target.value)}
                    placeholder={t("overrideImpsOptional")}
                    className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                    disabled={busy}
                  />
                </label>
              </div>
              <p className="text-xs text-zinc-600">{t("overrideImpsHelp")}</p>
              {weightedMatchImpsPreview ? (
                <p className="text-sm text-zinc-700">
                  {t("weightedMatchImpsPreview", {
                    home: weightedMatchImpsPreview.homeImps,
                    away: weightedMatchImpsPreview.awayImps,
                  })}
                </p>
              ) : (
                <p className="text-xs text-zinc-500">
                  {t("weightedMatchImpsPreviewPending")}
                </p>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={datumEligible}
                  onChange={(e) => setDatumEligible(e.target.checked)}
                  disabled={busy}
                />
                {t("datumEligible")}
              </label>
            </div>
          ) : null}

          {mode === "correct" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("contractLevel")}</span>
                <select
                  value={contractLevel}
                  onChange={(e) => setContractLevel(e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy || contractDenom === "PASS"}
                >
                  <option value="">{t("selectPlaceholder")}</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((level) => (
                    <option key={level} value={String(level)}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("denomination")}</span>
                <select
                  value={contractDenom}
                  onChange={(e) => {
                    const next = e.target.value;
                    setContractDenom(next);
                    if (next === "PASS") {
                      setContractLevel("");
                      setTricksResult("PASS");
                    } else if (contractLevel === "") {
                      setContractLevel("1");
                    }
                  }}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy}
                >
                  <option value="CLUBS">♣</option>
                  <option value="DIAMONDS">♦</option>
                  <option value="HEARTS">♥</option>
                  <option value="SPADES">♠</option>
                  <option value="NT">SA</option>
                  <option value="PASS">PASS</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("doubling")}</span>
                <select
                  value={doubling}
                  onChange={(e) => setDoubling(e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy || contractDenom === "PASS"}
                >
                  <option value="NONE">—</option>
                  <option value="DOUBLED">X</option>
                  <option value="REDOUBLED">XX</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("declarer")}</span>
                <select
                  value={declarer}
                  onChange={(e) => setDeclarer(e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy || contractDenom === "PASS"}
                >
                  <option value="N">N</option>
                  <option value="E">O</option>
                  <option value="S">Z</option>
                  <option value="W">W</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("tricksResult")}</span>
                <select
                  value={tricksResult}
                  onChange={(e) => setTricksResult(e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy || (contractDenom !== "PASS" && contractLevel === "")}
                >
                  {tricksResultOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("nsScoreOverride")}</span>
                <input
                  type="number"
                  value={nsScoreOverride}
                  onChange={(e) => setNsScoreOverride(e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy}
                />
              </label>
            </div>
          ) : null}

          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">{t("reason")}</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded border border-zinc-300 bg-white px-2 py-1.5"
              disabled={busy}
            />
          </label>

          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="mt-3 rounded border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
