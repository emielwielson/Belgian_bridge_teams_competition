"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FilePickerField } from "@/components/files/FilePickerField";
import type { MatchArbiterRequestsState } from "@/lib/competition/arbiter-request";
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
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
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

  async function handleFileChange(next: File | null) {
    setFile(next);
    setUploadedPath(null);
    setError(null);
    setMessage(null);

    if (!next) return;

    setUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append("file", next);
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
      setUploadedPath(uploadBody.path as string);
      setMessage(t("uploadedReady"));
    } catch (err) {
      setFile(null);
      setFileInputKey((k) => k + 1);
      setError(err instanceof Error ? err.message : t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadedPath) {
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
        body: JSON.stringify({ image_path: uploadedPath }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          translateApiError(body.error) ?? t("submitFailed"),
        );
      }
      setState(body.state);
      setFile(null);
      setUploadedPath(null);
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

  const canSubmit = Boolean(uploadedPath) && !busy && !uploading;

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
            file={file}
            onFileChange={handleFileChange}
            hint={t("attachmentHint")}
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
              <span
                className={
                  r.status === "open"
                    ? "font-medium text-amber-700"
                    : "font-medium text-emerald-700"
                }
              >
                {r.status === "open" ? t("statusOpen") : t("statusResolved")}
              </span>
              <span className="text-zinc-500">
                {t("submittedAt", {
                  datetime: formatBrussels(r.created_at, intlLocale),
                })}
              </span>
              {r.description ? (
                <p className="mt-1 text-zinc-700">{r.description}</p>
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
