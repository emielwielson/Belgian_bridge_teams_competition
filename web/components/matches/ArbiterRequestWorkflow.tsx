"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FilePickerField, FILE_PICKER_ACCEPT } from "@/components/files/FilePickerField";
import {
  ARBITER_REQUEST_MAX_ATTACHMENTS,
  type MatchArbiterRequestsState,
} from "@/lib/competition/arbiter-request";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { Locale } from "@/i18n/config";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";
import { formatBrussels } from "@/lib/time/brussels";

type Props = {
  matchId: string;
};

export function ArbiterRequestWorkflow({ matchId }: Props) {
  const t = useTranslations("match.arbiterRequest");
  const locale = useLocale() as Locale;
  const intlLocale = toIntlLocale(locale);
  const translateApiError = useTranslateApiError();
  const fileInputId = useId();
  const [state, setState] = useState<MatchArbiterRequestsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/matches/${matchId}/arbiter-requests`);
    if (res.status === 403) {
      setState(null);
      setError(t("loadFailed"));
      setLoading(false);
      return;
    }
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ? translateApiError(body.error) : t("loadFailed"));
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { state: MatchArbiterRequestsState };
    setState(body.state);
    setLoading(false);
  }, [matchId, t, translateApiError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadFile(file: File): Promise<string> {
    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("purpose", "arbiter_request");
    uploadData.append("matchId", matchId);
    const uploadRes = await fetch("/api/files/upload", {
      method: "POST",
      body: uploadData,
    });
    const uploadBody = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(
        translateApiError(uploadBody.error) ?? t("uploadFailed"),
      );
    }
    return uploadBody.path as string;
  }

  async function handleFilesChange(next: File[]) {
    setError(null);
    setMessage(null);

    if (next.length < files.length) {
      setFiles(next);
      setUploadedPaths((prev) => {
        const pathByKey = new Map(
          files.map((f, i) => [
            `${f.name}:${f.size}:${f.lastModified}`,
            prev[i]!,
          ]),
        );
        return next
          .map((f) => pathByKey.get(`${f.name}:${f.size}:${f.lastModified}`))
          .filter((p): p is string => Boolean(p));
      });
      return;
    }

    const added = next.slice(files.length);
    setFiles(next);
    if (added.length === 0) return;

    setUploading(true);
    try {
      const newPaths: string[] = [];
      for (const file of added) {
        newPaths.push(await uploadFile(file));
      }
      setUploadedPaths((prev) => [...prev, ...newPaths]);
      setMessage(t("uploadedReady"));
    } catch (err) {
      setFiles(files);
      setFileInputKey((k) => k + 1);
      setError(err instanceof Error ? err.message : t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (uploadedPaths.length === 0) {
      setError(t("uploadBeforeSubmit"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/arbiter-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_paths: uploadedPaths }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          translateApiError(body.error) ?? t("submitFailed"),
        );
      }
      setState(body.state);
      setFiles([]);
      setUploadedPaths([]);
      setFileInputKey((k) => k + 1);
      setMessage(t("submittedSuccess"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("submitFailedGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(requestId: string) {
    if (!window.confirm(t("cancelConfirm"))) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/arbiter/requests/${requestId}/cancel`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          translateApiError(body.error) ?? t("cancelFailed"),
        );
      }
      await load();
      setMessage(t("cancelledSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("cancelFailed"));
    } finally {
      setBusy(false);
    }
  }

  function statusLabel(status: string) {
    if (status === "open") return t("statusOpen");
    if (status === "cancelled") return t("statusCancelled");
    return t("statusResolved");
  }

  function statusClass(status: string) {
    if (status === "open") return "font-medium text-amber-700";
    if (status === "cancelled") return "font-medium text-zinc-600";
    return "font-medium text-emerald-700";
  }

  const canSubmit =
    uploadedPaths.length > 0 &&
    uploadedPaths.length === files.length &&
    !busy &&
    !uploading;

  if (loading) {
    return (
      <section className="card">
        <p className="text-sm text-zinc-600">{t("loading")}</p>
      </section>
    );
  }

  if (!state) {
    return (
      <section className="card">
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="font-semibold text-zinc-900">{t("title")}</h2>
      <p className="mt-1 text-xs text-zinc-500">{t("hint")}</p>

      {state.can_submit ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <FilePickerField
            key={fileInputKey}
            id={fileInputId}
            files={files}
            onFilesChange={handleFilesChange}
            multiple
            maxFiles={ARBITER_REQUEST_MAX_ATTACHMENTS}
            hint={t("attachmentHint")}
            accept={FILE_PICKER_ACCEPT}
            disabled={uploading || busy}
          />
          {uploading ? (
            <p className="text-sm text-zinc-600">{t("uploading")}</p>
          ) : null}
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary text-sm disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:opacity-100 hover:disabled:bg-zinc-400"
          >
            {busy ? t("submitting") : t("submit")}
          </button>
        </form>
      ) : null}

      {state.requests.length > 0 ? (
        <ul className="mt-4 divide-y divide-zinc-200 text-sm">
          {state.requests.map((r) => (
            <li key={r.id} className="py-2">
              <span className={statusClass(r.status)}>
                {statusLabel(r.status)}
              </span>
              <span className="text-zinc-500">
                {t("submittedAt", {
                  datetime: formatBrussels(r.created_at, intlLocale),
                })}
              </span>
              <p className="mt-1 text-zinc-600">
                {t("attachmentCount", { count: r.attachments.length })}
              </p>
              {r.description ? (
                <p className="mt-1 text-zinc-700">{r.description}</p>
              ) : null}
              {r.can_cancel ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCancel(r.id)}
                  className="mt-2 text-sm text-zinc-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("cancelButton")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : state.can_submit ? null : (
        <p className="mt-3 text-sm text-zinc-600">{t("noneYet")}</p>
      )}

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
    </section>
  );
}
