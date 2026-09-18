"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FilePickerField } from "@/components/files/FilePickerField";

type Completeness = {
  expected: number;
  received: number;
  valid: number;
  special: number;
  invalid: number;
  readyToPublish: boolean;
  missing: { message: string }[];
  blocking: { message: string }[];
};

type StatusPayload = {
  round: number;
  board_count: number;
  publication: { status: string; published_at: string | null };
  completeness: Completeness;
};

type BusyKind = "pbn" | "bws" | "recalc" | "publish";

export function HonorButlerImportPanel({
  round,
  enabled,
}: {
  round: number | null;
  enabled: boolean;
}) {
  const t = useTranslations("arbiter.honorButler");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [busy, setBusy] = useState<BusyKind | null>(null);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [pbnFile, setPbnFile] = useState<File | null>(null);
  const [bwsFile, setBwsFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    if (round == null || !enabled) return;
    const generation = ++loadGeneration.current;
    setStatusLoading(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch(`/api/arbiter/honor/rounds/${round}/publish`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? t("loadFailed"));
      }
      const data = (await res.json()) as StatusPayload;
      if (generation !== loadGeneration.current) return;
      setStatus(data);
    } catch (err) {
      if (generation !== loadGeneration.current) return;
      setError(err instanceof Error ? err.message : t("loadFailed"));
      setStatus(null);
    } finally {
      if (generation === loadGeneration.current) {
        setStatusLoading(false);
      }
    }
  }, [round, enabled, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setStatus(null);
    setStatusLoading(true);
    setPbnFile(null);
    setBwsFile(null);
    setMessage(null);
    setError(null);
  }, [round]);

  function startBusy(kind: BusyKind, filename?: string) {
    setBusy(kind);
    setBusyFile(filename ?? null);
    setMessage(null);
    setError(null);
  }

  function clearBusy() {
    setBusy(null);
    setBusyFile(null);
  }

  async function uploadPbn(file: File) {
    if (round == null) return;
    startBusy("pbn", file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/arbiter/honor/rounds/${round}/boards/pbn`,
        { method: "POST", body: form },
      );
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        boardCount?: number;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? t("pbnFailed"));
      setMessage(t("pbnSuccess", { count: body?.boardCount ?? 0 }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pbnFailed"));
    } finally {
      clearBusy();
    }
  }

  async function uploadBws(file: File) {
    if (round == null) return;
    startBusy("bws", file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/arbiter/honor/rounds/${round}/bridgemate/bws`,
        { method: "POST", body: form },
      );
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        created?: number;
        butlerUpdated?: number;
        matchScores?: { matchId: string }[] | null;
        mappingErrors?: string[];
      } | null;
      if (!res.ok) {
        const detail =
          body?.mappingErrors?.length && body.mappingErrors[0]
            ? ` ${body.mappingErrors[0]}`
            : "";
        throw new Error((body?.error ?? t("bwsFailed")) + detail);
      }
      if ((body?.created ?? 0) === 0) {
        throw new Error(
          body?.mappingErrors?.[0] ??
            t("bwsSuccess", {
              created: 0,
              butler: body?.butlerUpdated ?? 0,
            }),
        );
      }
      const matchScoreCount = body?.matchScores?.length ?? 0;
      setMessage(
        matchScoreCount > 0
          ? t("bwsSuccessWithMatchScores", {
              created: body?.created ?? 0,
              butler: body?.butlerUpdated ?? 0,
              matches: matchScoreCount,
            })
          : t("bwsSuccess", {
              created: body?.created ?? 0,
              butler: body?.butlerUpdated ?? 0,
            }),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("bwsFailed"));
    } finally {
      clearBusy();
    }
  }

  async function recalculate() {
    if (round == null) return;
    startBusy("recalc");
    try {
      const res = await fetch(
        `/api/arbiter/honor/rounds/${round}/recalculate`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        updatedCount?: number;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? t("recalcFailed"));
      setMessage(t("recalcSuccess", { count: body?.updatedCount ?? 0 }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("recalcFailed"));
    } finally {
      clearBusy();
    }
  }

  async function publish() {
    if (round == null) return;
    startBusy("publish");
    try {
      const res = await fetch(`/api/arbiter/honor/rounds/${round}/publish`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? t("publishFailed"));
      setMessage(published ? t("republishSuccess") : t("publishSuccess"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("publishFailed"));
    } finally {
      clearBusy();
    }
  }

  if (!enabled || round == null) return null;

  const c = status?.completeness;
  const published = status?.publication?.status === "published";
  const processingLabel =
    busy === "pbn"
      ? t("processingPbn")
      : busy === "bws"
        ? t("processingBws")
        : busy === "recalc"
          ? t("processingRecalc")
          : busy === "publish"
            ? t("processingPublish")
            : null;

  return (
    <section
      className="rounded-lg border border-zinc-200 bg-white px-4 py-4"
      aria-busy={busy != null}
    >
      <h2 className="text-lg font-semibold text-zinc-900">{t("title")}</h2>
      <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3">
          <p className="text-sm font-medium text-zinc-900">{t("uploadPbn")}</p>
          <div className="mt-2">
            <FilePickerField
              id={`honor-butler-pbn-${round}`}
              file={pbnFile}
              hint={t("pbnHint")}
              accept=".pbn"
              disabled={busy != null}
              onFileChange={(file) => {
                setPbnFile(file);
                if (file) void uploadPbn(file);
              }}
            />
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3">
          <p className="text-sm font-medium text-zinc-900">{t("uploadBws")}</p>
          <div className="mt-2">
            <FilePickerField
              id={`honor-butler-bws-${round}`}
              file={bwsFile}
              hint={t("bwsHint")}
              accept=".bws"
              disabled={busy != null}
              onFileChange={(file) => {
                setBwsFile(file);
                if (file) void uploadBws(file);
              }}
            />
          </div>
        </div>
      </div>

      {processingLabel ? (
        <div
          className="mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950"
          role="status"
          aria-live="polite"
        >
          <span
            className="mt-0.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-700 border-t-transparent"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-medium">{processingLabel}</p>
            {busyFile ? (
              <p className="mt-0.5 truncate text-xs text-amber-900/80">
                {busyFile}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {statusLoading && !status ? (
        <p className="mt-4 text-sm text-zinc-600">{t("working")}</p>
      ) : null}

      {status ? (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500">{t("boards")}</dt>
            <dd className="font-mono tabular-nums">{status.board_count}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{t("results")}</dt>
            <dd className="font-mono tabular-nums">
              {c?.received ?? 0}/{c?.expected ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">{t("status")}</dt>
            <dd>{published ? t("published") : t("draft")}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{t("ready")}</dt>
            <dd>{c?.readyToPublish ? t("yes") : t("no")}</dd>
          </div>
        </dl>
      ) : null}

      {c && c.blocking.length > 0 ? (
        <details className="mt-3 text-sm text-zinc-700">
          <summary className="cursor-pointer font-medium">
            {t("blocking", { count: c.blocking.length })}
          </summary>
          <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-zinc-600">
            {c.blocking.slice(0, 40).map((b, i) => (
              <li key={`${b.message}-${i}`}>{b.message}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void recalculate()}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {busy === "recalc" ? t("working") : t("recalculate")}
        </button>
        <button
          type="button"
          disabled={busy != null || !c?.readyToPublish}
          onClick={() => void publish()}
          className="rounded border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-300"
        >
          {busy === "publish"
            ? t("working")
            : published
              ? t("republish")
              : t("publish")}
        </button>
      </div>

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
