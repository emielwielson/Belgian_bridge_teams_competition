"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { FilePickerField } from "@/components/files/FilePickerField";
import type { MatchArbiterRequestsState } from "@/lib/competition/arbiter-request";
import { formatBrussels } from "@/lib/time/brussels";

type Props = {
  matchId: string;
};

export function ArbiterRequestWorkflow({ matchId }: Props) {
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
        throw new Error(uploadBody.error ?? "Upload failed");
      }
      setUploadedPath(uploadBody.path as string);
      setMessage("Attachment uploaded. You can submit the request.");
    } catch (err) {
      setFile(null);
      setFileInputKey((k) => k + 1);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadedPath) {
      setError("Upload an attachment before submitting");
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
        throw new Error(body.error ?? "Failed to submit request");
      }
      setState(body.state);
      setFile(null);
      setUploadedPath(null);
      setFileInputKey((k) => k + 1);
      setMessage(
        "Arbiter request submitted. Arbiters were notified by email.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = Boolean(uploadedPath) && !busy && !uploading;

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
        Upload a photo or PDF (max 10 MB), then submit to the arbiter.
      </p>

      {state.can_submit ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <FilePickerField
            key={fileInputKey}
            id={fileInputId}
            file={file}
            onFileChange={handleFileChange}
            hint="Attachment (PDF or image, required)"
            disabled={uploading || busy}
          />
          {uploading ? (
            <p className="text-sm text-zinc-600">Uploading attachment…</p>
          ) : null}
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary text-sm disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:opacity-100 hover:disabled:bg-zinc-400"
          >
            {busy ? "Submitting…" : "Submit to arbiter"}
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
                {r.status === "open" ? "Open" : "Resolved"}
              </span>
              <span className="text-zinc-500">
                {" "}
                · submitted {formatBrussels(r.created_at)}
              </span>
              {r.board != null ? (
                <p className="mt-1 text-zinc-600">Board {r.board}</p>
              ) : null}
              {r.description ? (
                <p className="mt-1 text-zinc-700">{r.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : state.can_submit ? null : (
        <p className="mt-3 text-sm text-zinc-600">No arbiter requests yet.</p>
      )}

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
    </section>
  );
}
