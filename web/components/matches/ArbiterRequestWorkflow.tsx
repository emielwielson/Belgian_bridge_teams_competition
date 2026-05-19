"use client";

import { useCallback, useEffect, useState } from "react";
import type { MatchArbiterRequestsState } from "@/lib/competition/arbiter-request";

type Props = {
  matchId: string;
};

export function ArbiterRequestWorkflow({ matchId }: Props) {
  const [state, setState] = useState<MatchArbiterRequestsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState("1");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/matches/${matchId}/arbiter-requests`);
    if (res.status === 403) {
      setState(null);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to load arbiter requests");
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { state: MatchArbiterRequestsState };
    setState(body.state);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let imagePath: string | null = null;
      if (file) {
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
          throw new Error(uploadBody.error ?? "Upload failed");
        }
        imagePath = uploadBody.path as string;
      }

      const res = await fetch(`/api/matches/${matchId}/arbiter-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: Number(board),
          description: description.trim(),
          image_path: imagePath,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to submit request");
      }
      setState(body.state);
      setDescription("");
      setFile(null);
      setMessage(
        "Arbiter request submitted. Arbiters were notified by email.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="card">
        <p className="text-sm text-zinc-600">Loading arbiter requests…</p>
      </section>
    );
  }

  if (!state) return null;

  return (
    <section className="card">
      <h2 className="font-semibold text-zinc-900">Arbiter request</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Request a ruling from the arbiter for a specific board (optional photo).
      </p>

      {state.can_submit ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-zinc-600">
            Board (1–{state.board_count})
            <input
              type="number"
              min={1}
              max={state.board_count}
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              className="mt-1 w-full max-w-[8rem] rounded-md border border-zinc-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
              placeholder="Describe the situation…"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            Photo (optional)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit to arbiter"}
          </button>
        </form>
      ) : null}

      {state.requests.length > 0 ? (
        <ul className="mt-4 divide-y divide-zinc-200 text-sm">
          {state.requests.map((r) => (
            <li key={r.id} className="py-2">
              <span className="font-medium">Board {r.board}</span> —{" "}
              <span
                className={
                  r.status === "open"
                    ? "text-amber-700"
                    : "text-emerald-700"
                }
              >
                {r.status === "open" ? "Open" : "Resolved"}
              </span>
              <p className="mt-1 text-zinc-700">{r.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">No arbiter requests yet.</p>
      )}

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
    </section>
  );
}
