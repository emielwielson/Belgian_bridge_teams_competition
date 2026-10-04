"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";

type Penalty = {
  id: string;
  team_id: string;
  penalty_date: string;
  reason: string;
  vp_deduction: number;
  file_path?: string | null;
  file_signed_url?: string | null;
  created_by_name?: string | null;
};

type Warning = {
  id: string;
  team_id: string;
  warning_date: string;
  reason: string;
  created_by_name?: string | null;
};

type Props = {
  teamId: string;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyPenaltyForm() {
  return {
    penalty_date: todayIsoDate(),
    reason: "",
    vp_deduction: "0",
    file: null as File | null,
  };
}

function emptyWarningForm() {
  return {
    warning_date: todayIsoDate(),
    reason: "",
  };
}

export function TeamDisciplineSection({ teamId }: Props) {
  const t = useTranslations("team.discipline");
  const translateApiError = useTranslateApiError();

  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [editingPenaltyId, setEditingPenaltyId] = useState<string | null>(null);
  const [penaltyForm, setPenaltyForm] = useState(emptyPenaltyForm);

  const [editingWarningId, setEditingWarningId] = useState<string | null>(null);
  const [warningForm, setWarningForm] = useState(emptyWarningForm);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [penRes, warnRes] = await Promise.all([
        fetch(`/api/arbiter/penalties?teamId=${encodeURIComponent(teamId)}`),
        fetch(`/api/arbiter/warnings?teamId=${encodeURIComponent(teamId)}`),
      ]);
      const penBody = await penRes.json();
      const warnBody = await warnRes.json();
      if (!penRes.ok) {
        throw new Error(
          translateApiError(penBody.error) ?? t("loadFailed"),
        );
      }
      if (!warnRes.ok) {
        throw new Error(
          translateApiError(warnBody.error) ?? t("loadFailed"),
        );
      }
      setPenalties(penBody.penalties ?? []);
      setWarnings(warnBody.warnings ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("loadFailed"));
      setPenalties([]);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }, [teamId, t, translateApiError]);

  useEffect(() => {
    void load();
  }, [load]);

  function addedByLabel(name: string | null | undefined): string {
    return t("addedBy", { name: name?.trim() || t("addedByUnknown") });
  }

  async function savePenalty() {
    if (!penaltyForm.reason.trim()) {
      setMessage(t("reasonRequired"));
      return;
    }
    const vp = Number(penaltyForm.vp_deduction);
    if (!Number.isFinite(vp) || vp < 0) {
      setMessage(t("vpNonNegative"));
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      let filePath: string | null = null;
      if (penaltyForm.file) {
        const uploadData = new FormData();
        uploadData.append("file", penaltyForm.file);
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

      const payload: Record<string, unknown> = {
        team_id: teamId,
        penalty_date: penaltyForm.penalty_date,
        reason: penaltyForm.reason.trim(),
        vp_deduction: vp,
      };
      if (filePath) payload.file_path = filePath;

      const url = editingPenaltyId
        ? `/api/arbiter/penalties/${editingPenaltyId}`
        : "/api/arbiter/penalties";
      const res = await fetch(url, {
        method: editingPenaltyId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(translateApiError(body.error) ?? t("saveFailed"));
      }

      const wasEditing = Boolean(editingPenaltyId);
      setEditingPenaltyId(null);
      setPenaltyForm(emptyPenaltyForm());
      await load();
      setMessage(wasEditing ? t("penaltyUpdated") : t("penaltyAdded"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function removePenalty(id: string) {
    if (!confirm(t("penaltyDeleteConfirm"))) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/arbiter/penalties/${id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(translateApiError(body.error) ?? t("deleteFailed"));
      }
      await load();
      setMessage(t("penaltyRemoved"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  function startEditPenalty(p: Penalty) {
    setEditingPenaltyId(p.id);
    setPenaltyForm({
      penalty_date: p.penalty_date,
      reason: p.reason,
      vp_deduction: String(p.vp_deduction),
      file: null,
    });
  }

  async function saveWarning() {
    if (!warningForm.reason.trim()) {
      setMessage(t("reasonRequired"));
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        team_id: teamId,
        warning_date: warningForm.warning_date,
        reason: warningForm.reason.trim(),
      };
      const url = editingWarningId
        ? `/api/arbiter/warnings/${editingWarningId}`
        : "/api/arbiter/warnings";
      const res = await fetch(url, {
        method: editingWarningId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(translateApiError(body.error) ?? t("saveFailed"));
      }

      const wasEditing = Boolean(editingWarningId);
      setEditingWarningId(null);
      setWarningForm(emptyWarningForm());
      await load();
      setMessage(wasEditing ? t("warningUpdated") : t("warningAdded"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeWarning(id: string) {
    if (!confirm(t("warningDeleteConfirm"))) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/arbiter/warnings/${id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(translateApiError(body.error) ?? t("deleteFailed"));
      }
      await load();
      setMessage(t("warningRemoved"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  function startEditWarning(w: Warning) {
    setEditingWarningId(w.id);
    setWarningForm({
      warning_date: w.warning_date,
      reason: w.reason,
    });
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-zinc-900">{t("title")}</h2>
      <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>

      {message ? (
        <p className="mt-3 text-xs text-zinc-700" role="status">
          {message}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-600">{t("loading")}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              {t("penaltiesTitle")}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-zinc-600">
                {t("date")}
                <input
                  type="date"
                  value={penaltyForm.penalty_date}
                  disabled={busy}
                  onChange={(e) =>
                    setPenaltyForm((f) => ({
                      ...f,
                      penalty_date: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-600">
                {t("vpDeduction")}
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={penaltyForm.vp_deduction}
                  disabled={busy}
                  onChange={(e) =>
                    setPenaltyForm((f) => ({
                      ...f,
                      vp_deduction: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
                {t("reason")}
                <textarea
                  value={penaltyForm.reason}
                  disabled={busy}
                  rows={2}
                  onChange={(e) =>
                    setPenaltyForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
                {t("documentOptional")}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(e) =>
                    setPenaltyForm((f) => ({
                      ...f,
                      file: e.target.files?.[0] ?? null,
                    }))
                  }
                  className="mt-1 block w-full text-sm text-zinc-600"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary text-sm disabled:opacity-50"
                disabled={busy}
                onClick={() => void savePenalty()}
              >
                {editingPenaltyId ? t("updatePenalty") : t("addPenalty")}
              </button>
              {editingPenaltyId ? (
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={busy}
                  onClick={() => {
                    setEditingPenaltyId(null);
                    setPenaltyForm(emptyPenaltyForm());
                  }}
                >
                  {t("cancelEdit")}
                </button>
              ) : null}
            </div>

            {penalties.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-600">{t("noPenalties")}</p>
            ) : (
              <ul className="mt-4 divide-y divide-zinc-100">
                {penalties.map((p) => (
                  <li key={p.id} className="py-3 first:pt-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-900">
                          {t("penaltyEntry", {
                            date: p.penalty_date,
                            vpDeduction: p.vp_deduction,
                          })}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600">{p.reason}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {addedByLabel(p.created_by_name)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {p.file_signed_url ? (
                          <a
                            href={p.file_signed_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-emerald-800 underline"
                          >
                            {t("viewDocument")}
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="text-sm font-medium text-zinc-700 underline"
                          disabled={busy}
                          onClick={() => startEditPenalty(p)}
                        >
                          {t("edit")}
                        </button>
                        <button
                          type="button"
                          className="text-sm font-medium text-red-700 underline"
                          disabled={busy}
                          onClick={() => void removePenalty(p.id)}
                        >
                          {t("delete")}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              {t("warningsTitle")}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-zinc-600">
                {t("date")}
                <input
                  type="date"
                  value={warningForm.warning_date}
                  disabled={busy}
                  onChange={(e) =>
                    setWarningForm((f) => ({
                      ...f,
                      warning_date: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
                {t("reason")}
                <textarea
                  value={warningForm.reason}
                  disabled={busy}
                  rows={2}
                  onChange={(e) =>
                    setWarningForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary text-sm disabled:opacity-50"
                disabled={busy}
                onClick={() => void saveWarning()}
              >
                {editingWarningId ? t("updateWarning") : t("addWarning")}
              </button>
              {editingWarningId ? (
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={busy}
                  onClick={() => {
                    setEditingWarningId(null);
                    setWarningForm(emptyWarningForm());
                  }}
                >
                  {t("cancelEdit")}
                </button>
              ) : null}
            </div>

            {warnings.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-600">{t("noWarnings")}</p>
            ) : (
              <ul className="mt-4 divide-y divide-zinc-100">
                {warnings.map((w) => (
                  <li key={w.id} className="py-3 first:pt-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-900">
                          {w.warning_date}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600">{w.reason}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {addedByLabel(w.created_by_name)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-sm font-medium text-zinc-700 underline"
                          disabled={busy}
                          onClick={() => startEditWarning(w)}
                        >
                          {t("edit")}
                        </button>
                        <button
                          type="button"
                          className="text-sm font-medium text-red-700 underline"
                          disabled={busy}
                          onClick={() => void removeWarning(w.id)}
                        >
                          {t("delete")}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
