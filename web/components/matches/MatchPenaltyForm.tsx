"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  DisciplinePenaltyFields,
  emptyPenaltyFields,
  isPenaltyFieldsComplete,
  penaltyFieldsToPayload,
  type TeamOption,
} from "@/components/discipline/DisciplinePenaltyFields";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";

type Props = {
  homeTeam: TeamOption;
  awayTeam: TeamOption;
};

export function MatchPenaltyForm({ homeTeam, awayTeam }: Props) {
  const t = useTranslations("match.penalty");
  const translateApiError = useTranslateApiError();
  const [fields, setFields] = useState(() => emptyPenaltyFields(homeTeam.id));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!isPenaltyFieldsComplete(fields)) {
      setMessage(t("motivationRequired"));
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      let filePath: string | null = null;
      if (file) {
        const uploadData = new FormData();
        uploadData.append("file", file);
        uploadData.append("purpose", "penalty");
        uploadData.append("matchId", fields.teamId);
        uploadData.append("teamId", fields.teamId);
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
        filePath = uploadBody.path ?? null;
      }

      const res = await fetch("/api/arbiter/penalties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...penaltyFieldsToPayload(fields),
          file_path: filePath,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          translateApiError(body.error) ?? t("saveFailed"),
        );
      }

      setFields(emptyPenaltyFields(homeTeam.id));
      setFile(null);
      setMessage(t("saved"));
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : t("saveFailedGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{t("title")}</h3>
      <p className="mt-1 text-xs text-zinc-500">{t("description")}</p>
      <div className="mt-3">
        <DisciplinePenaltyFields
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          value={fields}
          onChange={setFields}
          disabled={busy}
        />
        <label className="mt-3 block text-xs font-medium text-zinc-600">
          {t("documentOptional")}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-zinc-600"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="btn-primary mt-4 text-sm disabled:opacity-50"
      >
        {busy ? t("saving") : t("addPenalty")}
      </button>
      {message ? <p className="mt-2 text-xs text-zinc-700">{message}</p> : null}
    </section>
  );
}
