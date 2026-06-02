"use client";

import { useCallback, useEffect, useState } from "react";

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
      if (!res.ok) throw new Error(body.error ?? "Failed to load penalties");
      setPenalties(body.penalties ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form.team_id || !form.reason.trim()) {
      setMessage("Team and reason are required");
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
          throw new Error(uploadBody.error ?? "Upload failed");
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
        setMessage(body.error ?? "Save failed");
        return;
      }
      setEditingId(null);
      setForm({
        team_id: teams[0]?.id ?? "",
        penalty_date: new Date().toISOString().slice(0, 10),
        reason: "",
        vp_deduction: "0",
        file: null,
      });
      await load();
      setMessage(editingId ? "Penalty updated" : "Penalty added");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this penalty?")) return;
    const res = await fetch(`/api/admin/penalties/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Delete failed");
      return;
    }
    await load();
    setMessage("Penalty removed");
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
    return (
      <p className="text-sm text-zinc-600">
        Select a group above to manage VP penalties (standings corrections).
      </p>
    );
  }

  return (
    <section className="card mt-6">
      <h2 className="font-semibold text-zinc-900">Penalties & corrections</h2>
      <p className="mt-1 text-xs text-zinc-500">
        VP deductions apply to group standings for the active season.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-600">
          Team
          <select
            value={form.team_id}
            onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          >
            <option value="">Select team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Date
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
          Reason
          <input
            type="text"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          VP deduction
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
          Document (optional)
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
          {editingId ? "Update penalty" : "Add penalty"}
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
            Cancel edit
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="mt-2 text-sm text-zinc-700">{message}</p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-600">Loading…</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 text-sm">
          {penalties.length === 0 ? (
            <li className="py-2 text-zinc-600">No penalties for this group.</li>
          ) : (
            penalties.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  {(p.team as { name?: string } | null)?.name ?? "Team"} —{" "}
                  {p.penalty_date}: {p.reason} (−{p.vp_deduction} VP)
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-zinc-700 underline"
                    onClick={() => startEdit(p)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-red-700 underline"
                    onClick={() => remove(p.id)}
                  >
                    Delete
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
