"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Penalty = {
  id: string;
  team_id: string;
  penalty_date: string;
  reason: string;
  vp_deduction: number;
  file_path?: string | null;
  team?: { id: string; name: string; group_id: string } | null;
};

type Team = { id: string; name: string };

type Props = {
  groupId: string | null;
  teams: Team[];
};

export function PenaltyManagement({ groupId, teams }: Props) {
  const t = useTranslations("admin.penalties");
  const tCommon = useTranslations("common");

  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    team_id: "",
    penalty_date: new Date().toISOString().slice(0, 10),
    reason: "",
    vp_deduction: "0",
    file: null as File | null,
  });

  const load = useCallback(async () => {
    if (!groupId) {
      setPenalties([]);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/penalties?groupId=${groupId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("loadFailed"));
      setPenalties(body.penalties ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form.team_id || !form.reason.trim()) {
      setMessage(t("teamReasonRequired"));
      return;
    }
    setMessage(null);
    try {
      let filePath: string | null = null;
      if (form.file) {
        const uploadData = new FormData();
        uploadData.append("file", form.file);
        uploadData.append("purpose", "penalty");
        uploadData.append("matchId", form.team_id);
        uploadData.append("teamId", form.team_id);
        const uploadRes = await fetch("/api/files/upload", {
          method: "POST",
          body: uploadData,
        });
        const uploadBody = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadBody.error ?? t("saveFailed"));
        }
        filePath = uploadBody.path ?? null;
      }

      const payload = {
        team_id: form.team_id,
        penalty_date: form.penalty_date,
        reason: form.reason,
        vp_deduction: Number(form.vp_deduction),
        ...(filePath ? { file_path: filePath } : {}),
      };
      const url = editingId
        ? `/api/admin/penalties/${editingId}`
        : "/api/admin/penalties";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage(body.error ?? t("saveFailed"));
        return;
      }
      const wasEditing = editingId;
      setEditingId(null);
      setForm({
        team_id: teams[0]?.id ?? "",
        penalty_date: new Date().toISOString().slice(0, 10),
        reason: "",
        vp_deduction: "0",
        file: null,
      });
      await load();
      setMessage(wasEditing ? t("updated") : t("added"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("saveFailed"));
    }
  }

  async function remove(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    const res = await fetch(`/api/admin/penalties/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? t("deleteFailed"));
      return;
    }
    await load();
    setMessage(t("removed"));
  }

  function startEdit(p: Penalty) {
    setEditingId(p.id);
    setForm({
      team_id: p.team_id,
      penalty_date: p.penalty_date,
      reason: p.reason,
      vp_deduction: String(p.vp_deduction),
      file: null,
    });
  }

  if (!groupId) {
    return <p className="text-sm text-zinc-600">{t("selectGroup")}</p>;
  }

  return (
    <section className="card mt-6">
      <h2 className="font-semibold text-zinc-900">{t("title")}</h2>
      <p className="mt-1 text-xs text-zinc-500">{t("description")}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-600">
          {t("team")}
          <select
            value={form.team_id}
            onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          >
            <option value="">{t("selectTeam")}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          {t("date")}
          <input
            type="date"
            value={form.penalty_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, penalty_date: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
          {t("reason")}
          <input
            type="text"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          {t("vpDeduction")}
          <input
            type="number"
            min={0}
            step={0.5}
            value={form.vp_deduction}
            onChange={(e) =>
              setForm((f) => ({ ...f, vp_deduction: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
          {t("documentOptional")}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) =>
              setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))
            }
            className="mt-1 block w-full text-sm text-zinc-600"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={save} className="btn-primary text-sm">
          {editingId ? t("update") : t("add")}
        </button>
        {editingId ? (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({
                team_id: teams[0]?.id ?? "",
                penalty_date: new Date().toISOString().slice(0, 10),
                reason: "",
                vp_deduction: "0",
                file: null,
              });
            }}
            className="btn-secondary text-sm"
          >
            {t("cancelEdit")}
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="mt-2 text-sm text-zinc-700">{message}</p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-600">{t("loading")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 text-sm">
          {penalties.length === 0 ? (
            <li className="py-2 text-zinc-600">{t("none")}</li>
          ) : (
            penalties.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  {t("entry", {
                    teamName:
                      (p.team as { name?: string } | null)?.name ??
                      t("teamFallback"),
                    date: p.penalty_date,
                    reason: p.reason,
                    vp: p.vp_deduction,
                  })}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-zinc-700 underline"
                    onClick={() => startEdit(p)}
                  >
                    {tCommon("edit")}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-red-700 underline"
                    onClick={() => remove(p.id)}
                  >
                    {tCommon("delete")}
                  </button>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
