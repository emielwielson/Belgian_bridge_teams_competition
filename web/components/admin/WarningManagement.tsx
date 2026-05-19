"use client";

import { useCallback, useEffect, useState } from "react";

type Warning = {
  id: string;
  team_id: string;
  warning_date: string;
  reason: string;
  team?: { id: string; name: string; group_id: string } | null;
};

type Team = { id: string; name: string };

type Props = {
  groupId: string | null;
  teams: Team[];
};

export function WarningManagement({ groupId, teams }: Props) {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    team_id: "",
    warning_date: new Date().toISOString().slice(0, 10),
    reason: "",
  });

  const load = useCallback(async () => {
    if (!groupId) {
      setWarnings([]);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/warnings?groupId=${groupId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load warnings");
      setWarnings(body.warnings ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form.team_id || !form.reason.trim()) {
      setMessage("Team and reason are required");
      return;
    }
    setMessage(null);
    const payload = {
      team_id: form.team_id,
      warning_date: form.warning_date,
      reason: form.reason,
    };
    const url = editingId
      ? `/api/admin/warnings/${editingId}`
      : "/api/admin/warnings";
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
      warning_date: new Date().toISOString().slice(0, 10),
      reason: "",
    });
    await load();
    setMessage(editingId ? "Warning updated" : "Warning added");
  }

  async function remove(id: string) {
    if (!confirm("Delete this warning?")) return;
    const res = await fetch(`/api/admin/warnings/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Delete failed");
      return;
    }
    await load();
    setMessage("Warning removed");
  }

  function startEdit(w: Warning) {
    setEditingId(w.id);
    setForm({
      team_id: w.team_id,
      warning_date: w.warning_date,
      reason: w.reason,
    });
  }

  if (!groupId) {
    return (
      <p className="text-sm text-zinc-600">
        Select a group above to manage team warnings.
      </p>
    );
  }

  return (
    <section className="card mt-6">
      <h2 className="font-semibold text-zinc-900">Warnings</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Formal warnings issued to teams (visible on standings context).
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
            value={form.warning_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, warning_date: e.target.value }))
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
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={save} className="btn-primary text-sm">
          {editingId ? "Update warning" : "Add warning"}
        </button>
        {editingId ? (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({
                team_id: teams[0]?.id ?? "",
                warning_date: new Date().toISOString().slice(0, 10),
                reason: "",
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
          {warnings.length === 0 ? (
            <li className="py-2 text-zinc-600">No warnings for this group.</li>
          ) : (
            warnings.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  {(w.team as { name?: string } | null)?.name ?? "Team"} —{" "}
                  {w.warning_date}: {w.reason}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-zinc-700 underline"
                    onClick={() => startEdit(w)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-red-700 underline"
                    onClick={() => remove(w.id)}
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
