"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatBrussels } from "@/lib/time/brussels";

type InboxRequest = {
  id: string;
  match_id: string;
  board: number;
  description: string;
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

export function ArbiterInbox() {
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function resolve(requestId: string) {
    setBusyId(requestId);
    setMessage(null);
    const res = await fetch(`/api/arbiter/requests/${requestId}/resolve`, {
      method: "POST",
    });
    const body = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setMessage(body.error ?? "Failed to resolve");
      return;
    }
    await load();
    setMessage("Request marked resolved");
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
            return (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-900">
                      {label} — board {r.board}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Submitted {formatBrussels(r.created_at)}
                      {m?.datetime
                        ? ` · Match ${formatBrussels(m.datetime)}`
                        : ""}
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">{r.description}</p>
                    {r.image_signed_url ? (
                      <p className="mt-2">
                        <a
                          href={r.image_signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-emerald-800 underline"
                        >
                          View attachment
                        </a>
                      </p>
                    ) : null}
                    <p className="mt-2">
                      <Link
                        href={`/matches/${r.match_id}`}
                        className="text-sm text-zinc-600 underline hover:text-zinc-900"
                      >
                        Open match
                      </Link>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => resolve(r.id)}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {busyId === r.id ? "…" : "Mark resolved"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
