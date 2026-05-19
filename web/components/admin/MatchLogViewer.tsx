"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatBrussels } from "@/lib/time/brussels";

type LogRow = {
  id: string;
  match_id: string;
  action: string;
  user_id: string | null;
  created_at: string;
  match?: {
    round: number;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  } | null;
};

type Props = {
  groupId: string | null;
};

export function MatchLogViewer({ groupId }: Props) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");

  const load = useCallback(async () => {
    if (!groupId) {
      setLogs([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setMessage(null);
    const params = new URLSearchParams({ groupId, limit: "100" });
    if (actionFilter.trim()) {
      params.set("action", actionFilter.trim());
    }
    try {
      const res = await fetch(`/api/admin/match-logs?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load logs");
      setLogs(body.logs ?? []);
      setTotal(body.total ?? 0);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [groupId, actionFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!groupId) {
    return (
      <p className="text-sm text-zinc-600">
        Select a group above to browse match audit logs.
      </p>
    );
  }

  return (
    <section className="card mt-6">
      <h2 className="font-semibold text-zinc-900">Match audit log</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Recent actions on matches in this group ({total} total).
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block text-xs font-medium text-zinc-600">
          Action prefix
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="e.g. ruling_"
            className="mt-1 w-40 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button type="button" onClick={load} className="btn-secondary text-sm">
          Refresh
        </button>
      </div>

      {message ? (
        <p className="mt-2 text-sm text-zinc-700">{message}</p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-600">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Match</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-zinc-600">
                    No log entries.
                  </td>
                </tr>
              ) : (
                logs.map((row) => {
                  const m = row.match;
                  const matchLabel = m
                    ? `R${m.round} ${m.home_team?.name ?? "?"} vs ${m.away_team?.name ?? "?"}`
                    : row.match_id.slice(0, 8);
                  return (
                    <tr key={row.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-3 whitespace-nowrap text-zinc-600">
                        {formatBrussels(row.created_at)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {row.action}
                      </td>
                      <td className="py-2 pr-3">
                        <Link
                          href={`/matches/${row.match_id}`}
                          className="text-emerald-800 underline"
                        >
                          {matchLabel}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
