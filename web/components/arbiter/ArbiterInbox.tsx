"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FilePickerField } from "@/components/files/FilePickerField";
import { formatBrussels } from "@/lib/time/brussels";

type InboxRequest = {
  id: string;
  match_id: string;
  board: number | null;
  description: string | null;
  status: string;
  created_at: string;
  image_signed_url: string | null;
  match: {
    round: number;
    datetime: string;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  } | null;
};

type ResolveDraft = {
  file: File | null;
  uploadedPath: string | null;
  uploading: boolean;
  fileInputKey: number;
  board: string;
  rulingDate: string;
};

function emptyDraft(): ResolveDraft {
  return {
    file: null,
    uploadedPath: null,
    uploading: false,
    fileInputKey: 0,
    board: "",
    rulingDate: new Date().toISOString().slice(0, 10),
  };
}

export function ArbiterInbox() {
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveDrafts, setResolveDrafts] = useState<
    Record<string, ResolveDraft>
  >({});
  const [rulingLinks, setRulingLinks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/arbiter/requests?status=open");
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Failed to load inbox");
      setLoading(false);
      return;
    }
    setRequests(body.requests ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(requestId: string, patch: Partial<ResolveDraft>) {
    setResolveDrafts((prev) => ({
      ...prev,
      [requestId]: { ...(prev[requestId] ?? emptyDraft()), ...patch },
    }));
  }

  async function handleRulingFileChange(
    request: InboxRequest,
    next: File | null,
  ) {
    const requestId = request.id;
    const draft = resolveDrafts[requestId] ?? emptyDraft();

    updateDraft(requestId, {
      file: next,
      uploadedPath: null,
      uploading: Boolean(next),
    });

    if (!next) return;

    try {
      const uploadData = new FormData();
      uploadData.append("file", next);
      uploadData.append("purpose", "ruling");
      uploadData.append("matchId", request.match_id);
      const uploadRes = await fetch("/api/files/upload", {
        method: "POST",
        body: uploadData,
      });
      const uploadBody = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadBody.error ?? "Failed to upload ruling");
      }
      updateDraft(requestId, {
        file: next,
        uploadedPath: uploadBody.path as string,
        uploading: false,
      });
    } catch (e) {
      updateDraft(requestId, {
        file: null,
        uploadedPath: null,
        uploading: false,
        fileInputKey: draft.fileInputKey + 1,
      });
      setMessage(e instanceof Error ? e.message : "Failed to upload ruling");
    }
  }

  async function resolve(request: InboxRequest) {
    const draft = resolveDrafts[request.id] ?? emptyDraft();
    if (!draft.uploadedPath) {
      setMessage("Upload an official ruling document before resolving.");
      return;
    }

    setBusyId(request.id);
    setMessage(null);

    try {
      const board =
        draft.board.trim() !== "" && Number.isFinite(Number(draft.board))
          ? Number(draft.board)
          : null;

      const res = await fetch(
        `/api/arbiter/requests/${request.id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_path: draft.uploadedPath,
            board,
            ruling_date: draft.rulingDate,
          }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to resolve");
      }

      if (body.rulingSignedUrl) {
        setRulingLinks((prev) => ({
          ...prev,
          [request.id]: body.rulingSignedUrl,
        }));
      }

      setResolveDrafts((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      await load();
      setMessage("Request resolved with official ruling.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to resolve");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {message ? <p className="mb-4 text-sm text-zinc-700">{message}</p> : null}
      {loading ? (
        <p className="text-sm text-zinc-600">Loading open requests…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-zinc-600">No open arbiter requests.</p>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {requests.map((r) => {
            const m = r.match;
            const label = m
              ? `Round ${m.round}: ${m.home_team?.name ?? "?"} vs ${m.away_team?.name ?? "?"}`
              : "Match";
            const draft = resolveDrafts[r.id] ?? emptyDraft();
            const rulingLink = rulingLinks[r.id];
            const canResolve =
              Boolean(draft.uploadedPath) &&
              !draft.uploading &&
              busyId !== r.id;
            return (
              <li key={r.id} className="py-4">
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="font-medium text-zinc-900">{label}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Submitted {formatBrussels(r.created_at)}
                      {m?.datetime
                        ? ` · Match ${formatBrussels(m.datetime)}`
                        : ""}
                    </p>
                    {r.image_signed_url ? (
                      <p className="mt-2">
                        <a
                          href={r.image_signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-emerald-800 underline"
                        >
                          View captain attachment
                        </a>
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-600">
                        No attachment available
                      </p>
                    )}
                    <p className="mt-2">
                      <Link
                        href={`/matches/${r.match_id}`}
                        className="text-sm text-zinc-600 underline hover:text-zinc-900"
                      >
                        Open match
                      </Link>
                    </p>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-sm font-medium text-zinc-900">
                      Resolve with official ruling
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Upload the ruling document (required). Board optional.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <FilePickerField
                          key={draft.fileInputKey}
                          id={`ruling-file-${r.id}`}
                          file={draft.file}
                          onFileChange={(next) =>
                            void handleRulingFileChange(r, next)
                          }
                          hint="Official ruling (PDF or image, required, max 10 MB)"
                          disabled={busyId === r.id || draft.uploading}
                        />
                        {draft.uploading ? (
                          <p className="mt-1 text-xs text-zinc-600">
                            Uploading ruling…
                          </p>
                        ) : draft.uploadedPath ? (
                          <p className="mt-1 text-xs text-emerald-800">
                            Ruling uploaded. You can resolve the request.
                          </p>
                        ) : null}
                      </div>
                      <label className="block text-xs font-medium text-zinc-600">
                        Board (optional)
                        <input
                          type="number"
                          min={1}
                          value={draft.board}
                          disabled={busyId === r.id}
                          onChange={(e) =>
                            updateDraft(r.id, { board: e.target.value })
                          }
                          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-xs font-medium text-zinc-600">
                        Ruling date
                        <input
                          type="date"
                          value={draft.rulingDate}
                          disabled={busyId === r.id}
                          onChange={(e) =>
                            updateDraft(r.id, { rulingDate: e.target.value })
                          }
                          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={!canResolve}
                      onClick={() => resolve(r)}
                      className="btn-primary mt-3 text-sm disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:opacity-100 hover:disabled:bg-zinc-400"
                    >
                      {busyId === r.id ? "Resolving…" : "Resolve with ruling"}
                    </button>
                    {rulingLink ? (
                      <p className="mt-2 text-sm">
                        <a
                          href={rulingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-emerald-800 underline"
                        >
                          View published ruling
                        </a>
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
