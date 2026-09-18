"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { formatContract } from "@/lib/butler/format";
import { roundWeightedNsScore } from "@/lib/results/adjustment-helpers";

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
  admin_ns_butler_imps: number | null;
  admin_ew_butler_imps: number | null;
  adjustment_mode: string | null;
};

type Mode = "cancelled" | "artificial" | "split" | "weighted" | "correct";
type Filter = "needs_attention" | "all" | "special" | "invalid";
type PickBy = "match" | "table";

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
  const [filter, setFilter] = useState<Filter>("needs_attention");
  const [rows, setRows] = useState<HonorResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickBy, setPickBy] = useState<PickBy>("match");
  const [matchId, setMatchId] = useState("");
  const [room, setRoom] = useState<"open" | "closed" | "">("");
  const [tableNumber, setTableNumber] = useState("");
  const [boardNumber, setBoardNumber] = useState("");
  const [mode, setMode] = useState<Mode>("artificial");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Shared form fields
  const [reason, setReason] = useState("");
  const [adminNsScore, setAdminNsScore] = useState("");
  const [adminNsImps, setAdminNsImps] = useState("");
  const [adminEwImps, setAdminEwImps] = useState("");
  const [datumEligible, setDatumEligible] = useState(false);
  const [scoreA, setScoreA] = useState("");
  const [weightA, setWeightA] = useState("1");
  const [scoreB, setScoreB] = useState("");
  const [weightB, setWeightB] = useState("1");
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

  const attentionCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.validation_status === "special" ||
          r.validation_status === "invalid",
      ).length,
    [rows],
  );

  const load = useCallback(async () => {
    if (round == null || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/arbiter/honor/rounds/${round}/results?filter=${filter}`,
      );
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        results?: HonorResultRow[];
      } | null;
      if (!res.ok) throw new Error(body?.error ?? t("loadFailed"));
      setRows(body?.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadFailed"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [round, enabled, filter, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    setMatchId("");
    setRoom("");
    setTableNumber("");
    setBoardNumber("");
  }, [filter, round]);

  useEffect(() => {
    if (pickBy === "match") {
      setTableNumber("");
    } else {
      setMatchId("");
      setRoom("");
    }
    setBoardNumber("");
  }, [pickBy]);

  useEffect(() => {
    setRoom("");
    setBoardNumber("");
  }, [matchId]);

  useEffect(() => {
    setBoardNumber("");
  }, [room, tableNumber]);

  useEffect(() => {
    if (!selected) return;
    setAdminNsScore(
      selected.admin_adjusted_ns_score != null
        ? String(selected.admin_adjusted_ns_score)
        : selected.ns_score != null
          ? String(selected.ns_score)
          : "",
    );
    setAdminNsImps(
      selected.admin_ns_butler_imps != null
        ? String(selected.admin_ns_butler_imps)
        : "",
    );
    setAdminEwImps(
      selected.admin_ew_butler_imps != null
        ? String(selected.admin_ew_butler_imps)
        : "",
    );
    setDatumEligible(selected.datum_eligible === true);
    setContractLevel(
      selected.contract_level != null ? String(selected.contract_level) : "",
    );
    setContractDenom(selected.contract_denomination ?? "NT");
    setDoubling(selected.doubling ?? "NONE");
    setDeclarer(selected.declarer ?? "N");
    setTricksResult(selected.tricks_result ?? "=");
    setNsScoreOverride("");
    setReason("");
    if (
      selected.validation_status === "special" ||
      selected.special_result_kind === "not_played" ||
      selected.special_result_kind === "erased"
    ) {
      setMode(
        selected.special_result_kind === "not_played" ||
          selected.special_result_kind === "erased"
          ? "cancelled"
          : "artificial",
      );
    }
  }, [selected]);

  const weightedPreview = useMemo(() => {
    const a = Number(scoreA);
    const wa = Number(weightA);
    const b = Number(scoreB);
    const wb = Number(weightB);
    if (![a, wa, b, wb].every((n) => Number.isFinite(n)) || wa <= 0 || wb <= 0) {
      return null;
    }
    try {
      return roundWeightedNsScore({
        scoreA: a,
        weightA: wa,
        scoreB: b,
        weightB: wb,
      });
    } catch {
      return null;
    }
  }, [scoreA, weightA, scoreB, weightB]);

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
    const byDir = new Map(
      (selected.players ?? []).map((p) => [p.direction, p.name]),
    );
    const n = byDir.get("N");
    const e = byDir.get("E");
    const s = byDir.get("S");
    const w = byDir.get("W");
    if (!n && !e && !s && !w) return null;
    return t("selectedPlayers", {
      n: n ?? "—",
      e: e ?? "—",
      s: s ?? "—",
      w: w ?? "—",
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
        if (mode === "artificial") {
          payload.adminAdjustedNsScore =
            adminNsScore === "" ? null : Number(adminNsScore);
          payload.adminNsButlerImps =
            adminNsImps === "" ? null : Number(adminNsImps);
          payload.adminEwButlerImps =
            adminEwImps === "" ? null : Number(adminEwImps);
          payload.datumEligible = datumEligible;
        } else if (mode === "split") {
          payload.adminNsButlerImps = Number(adminNsImps);
          payload.adminEwButlerImps = Number(adminEwImps);
          payload.adminAdjustedNsScore =
            adminNsScore === "" ? null : Number(adminNsScore);
          payload.datumEligible = datumEligible;
        } else if (mode === "weighted") {
          payload.scoreA = Number(scoreA);
          payload.weightA = Number(weightA);
          payload.scoreB = Number(scoreB);
          payload.weightB = Number(weightB);
          payload.datumEligible = datumEligible;
          payload.adminNsButlerImps =
            adminNsImps === "" ? null : Number(adminNsImps);
          payload.adminEwButlerImps =
            adminEwImps === "" ? null : Number(adminEwImps);
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">{t("title")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">{t("filter")}</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="rounded border border-zinc-300 bg-white px-2 py-1.5"
          >
            <option value="needs_attention">{t("filterNeedsAttention")}</option>
            <option value="special">{t("filterSpecial")}</option>
            <option value="invalid">{t("filterInvalid")}</option>
            <option value="all">{t("filterAll")}</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-zinc-600">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">{t("empty")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {attentionCount > 0 && filter === "all" ? (
            <p className="text-sm text-amber-800">
              {t("attentionHint", { count: attentionCount })}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPickBy("match")}
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
              onClick={() => setPickBy("table")}
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
                    onChange={(e) => setMatchId(e.target.value)}
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
                    onChange={(e) =>
                      setRoom(e.target.value as "open" | "closed" | "")
                    }
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
                  onChange={(e) => setTableNumber(e.target.value)}
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
                  const mark =
                    row &&
                    (row.validation_status === "special" ||
                      row.validation_status === "invalid")
                      ? " !"
                      : "";
                  return (
                    <option key={bn} value={String(bn)}>
                      {t("boardOption", { board: bn })}
                      {mark}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
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
                  score:
                    selected.admin_adjusted_ns_score ??
                    selected.ns_score ??
                    "—",
                })
              : t("selectedMetaNoTable", {
                  contract: selectedContractLabel,
                  score:
                    selected.admin_adjusted_ns_score ??
                    selected.ns_score ??
                    "—",
                })}
          </p>
          <p className="mt-1 text-xs text-zinc-700">
            {selectedPlayersLabel ?? t("selectedPlayersMissing")}
          </p>

          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">{t("mode")}</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="rounded border border-zinc-300 bg-white px-2 py-1.5"
              disabled={busy}
            >
              <option value="cancelled">{t("modeCancelled")}</option>
              <option value="artificial">{t("modeArtificial")}</option>
              <option value="split">{t("modeSplit")}</option>
              <option value="weighted">{t("modeWeighted")}</option>
              <option value="correct">{t("modeCorrect")}</option>
            </select>
          </label>

          <p className="mt-2 text-xs text-zinc-600">{t(`modeHelp_${mode}`)}</p>

          {mode === "artificial" || mode === "split" || mode === "weighted" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("adminNsScore")}</span>
                <input
                  type="number"
                  value={
                    mode === "weighted" && weightedPreview != null
                      ? String(weightedPreview)
                      : adminNsScore
                  }
                  onChange={(e) => setAdminNsScore(e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy || mode === "weighted"}
                  placeholder={mode === "weighted" ? t("fromWeights") : undefined}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("adminNsImps")}</span>
                <input
                  type="number"
                  step="0.5"
                  value={adminNsImps}
                  onChange={(e) => setAdminNsImps(e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("adminEwImps")}</span>
                <input
                  type="number"
                  step="0.5"
                  value={adminEwImps}
                  onChange={(e) => setAdminEwImps(e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy}
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
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

          {mode === "weighted" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("scoreA")}</span>
                <input
                  type="number"
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("weightA")}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={weightA}
                  onChange={(e) => setWeightA(e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("scoreB")}</span>
                <input
                  type="number"
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">{t("weightB")}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={weightB}
                  onChange={(e) => setWeightB(e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5"
                  disabled={busy}
                />
              </label>
              <p className="text-sm text-zinc-700 sm:col-span-2">
                {t("weightedPreview", {
                  score: weightedPreview ?? "—",
                })}
              </p>
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
