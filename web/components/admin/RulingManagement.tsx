"use client";

import { useCallback, useEffect, useState } from "react";

type MatchOption = {
  id: string;
  round: number;
  datetime: string;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
};

type Ruling = {
  id: string;
  match_id: string;
  board: number;
  file_path: string;
  ruling_date: string | null;
  signed_url: string | null;
  match?: {
    round: number;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  } | null;
};

type Props = {
  groupId: string | null;
};

function matchLabel(m: MatchOption): string {
  const home = m.home_team?.name ?? "Home";
  const away = m.away_team?.name ?? "Away";
  return `R${m.round}: ${home} vs ${away}`;
}

export function RulingManagement({ groupId }: Props) {
  const [rulings, setRulings] = useState<Ruling[]>([]);
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    match_id: "",
    board: "1",
    ruling_date: new Date().toISOString().slice(0, 10),
    file: null as File | null,
  });

  const loadRulings = useCallback(async () => {
    if (!groupId) {
      setRulings([]);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/rulings?groupId=${groupId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load rulings");
      setRulings(body.rulings ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadMatches = useCallback(async () => {
    if (!groupId) {
      setMatches([]);
      return;
    }
    const res = await fetch(`/api/admin/groups/${groupId}/matches`);
    const body = await res.json();
    if (res.ok) {
      setMatches(body.matches ?? []);
      if (body.matches?.[0]?.id) {
        setForm((f) =>
          f.match_id ? f : { ...f, match_id: body.matches[0].id },
        );
      }
    }
  }, [groupId]);

  useEffect(() => {
    void loadRulings();
    void loadMatches();
  }, [loadRulings, loadMatches]);

  async function save() {
    if (!form.match_id || !form.file) {
      setMessage("Match and PDF/image file are required");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const uploadData = new FormData();
      uploadData.append("file", form.file);
      uploadData.append("purpose", "ruling");
      uploadData.append("matchId", form.match_id);

      const uploadRes = await fetch("/api/files/upload", {
        method: "POST",
        body: uploadData,
      });
      const uploadBody = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadBody.error ?? "Upload failed");
      }

      const res = await fetch("/api/admin/rulings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: form.match_id,
          board: Number(form.board),
          file_path: uploadBody.path,
          ruling_date: form.ruling_date,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Save failed");

      setForm({
        match_id: matches[0]?.id ?? "",
        board: "1",
        ruling_date: new Date().toISOString().slice(0, 10),
        file: null,
      });
      await loadRulings();
      setMessage("Ruling added");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this ruling and its file?")) return;
    const res = await fetch(`/api/admin/rulings/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Delete failed");
      return;
    }
    await loadRulings();
    setMessage("Ruling removed");
  }

  if (!groupId) {
    return (
      <p className="text-sm text-zinc-600">
        Select a group above to manage match rulings.
      </p>
    );
  }

  return (
    <section className="card mt-6">
      <h2 className="font-semibold text-zinc-900">Rulings</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Official rulings per match and board (PDF or image, max 10 MB).
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
          Match
          <select
            value={form.match_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, match_id: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          >
            <option value="">Select match</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {matchLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Board
          <input
            type="number"
            min={1}
            value={form.board}
            onChange={(e) => setForm((f) => ({ ...f, board: e.target.value }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Ruling date
          <input
            type="date"
            value={form.ruling_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, ruling_date: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
          File (PDF or image)
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                file: e.target.files?.[0] ?? null,
              }))
            }
            className="mt-1 w-full text-sm"
          />
        </label>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Add ruling"}
        </button>
      </div>

      {message ? (
        <p className="mt-2 text-sm text-zinc-700">{message}</p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-600">Loading…</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 text-sm">
          {rulings.length === 0 ? (
            <li className="py-2 text-zinc-600">No rulings for this group.</li>
          ) : (
            rulings.map((r) => {
              const m = r.match;
              const label = m
                ? `R${m.round}: ${m.home_team?.name ?? "?"} vs ${m.away_team?.name ?? "?"} — board ${r.board}`
                : `Board ${r.board}`;
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    {label}
                    {r.ruling_date ? ` (${r.ruling_date})` : ""}
                    {r.signed_url ? (
                      <>
                        {" "}
                        <a
                          href={r.signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-emerald-800 underline"
                        >
                          View file
                        </a>
                      </>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium text-red-700 underline"
                    onClick={() => remove(r.id)}
                  >
                    Delete
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </section>
  );
}
