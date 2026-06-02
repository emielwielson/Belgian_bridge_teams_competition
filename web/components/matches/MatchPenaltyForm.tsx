"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";

type TeamOption = {
  id: string;
  name: string;
};

type Props = {
  homeTeam: TeamOption;
  awayTeam: TeamOption;
};

export function MatchPenaltyForm({ homeTeam, awayTeam }: Props) {
  const t = useTranslations("match.penalty");
  const translateApiError = useTranslateApiError();
  const [teamId, setTeamId] = useState(homeTeam.id);
  const [penaltyDate, setPenaltyDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState("");
  const [vpDeduction, setVpDeduction] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) {
      setMessage(t("motivationRequired"));
      return;
    }
    const vp = Number(vpDeduction);
    if (!Number.isFinite(vp) || vp < 0) {
      setMessage(t("vpNonNegative"));
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
        uploadData.append("matchId", teamId);
        uploadData.append("teamId", teamId);
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
          team_id: teamId,
          penalty_date: penaltyDate,
          reason: reason.trim(),
          vp_deduction: vp,
          file_path: filePath,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          translateApiError(body.error) ?? t("saveFailed"),
        );
      }

      setReason("");
      setVpDeduction("0");
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
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-600">
          {t("team")}
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          >
            <option value={homeTeam.id}>{homeTeam.name}</option>
            <option value={awayTeam.id}>{awayTeam.name}</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          {t("date")}
          <input
            type="date"
            value={penaltyDate}
            onChange={(e) => setPenaltyDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
          {t("vpDeduction")}
          <input
            type="number"
            min={0}
            step={0.1}
            value={vpDeduction}
            onChange={(e) => setVpDeduction(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
          {t("motivation")}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
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
