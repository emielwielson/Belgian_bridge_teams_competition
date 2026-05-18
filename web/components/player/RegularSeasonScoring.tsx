"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatBrussels } from "@/lib/time/brussels";

type ScorableMatch = {
  id: string;
  round: number;
  datetime: string;
  home_team: { name: string };
  away_team: { name: string };
  group_name: string;
  status: "scheduled";
};

type Props = {
  linkedPlayerName: string | null;
};

export function RegularSeasonScoring({ linkedPlayerName }: Props) {
  const [matches, setMatches] = useState<ScorableMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/matches/scorable");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load matches");
      setMatches(body.matches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!linkedPlayerName) {
    return (
      <p className="mt-2 text-sm text-amber-800">
        Your account is not linked to a player profile yet. Ask your club manager
        to link your user to your player record.
      </p>
    );
  }

  if (loading) {
    return <p className="mt-4 text-sm text-zinc-600">Loading matches…</p>;
  }

  if (error) {
    return <p className="mt-4 text-sm text-red-600">{error}</p>;
  }

  if (matches.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-600">
        No matches ready to score. Check back when a scheduled match is assigned to
        you.
      </p>
    );
  }

  return (
    <ul className="mt-4 flex flex-col gap-3">
      {matches.map((m) => (
        <li key={m.id}>
          <Link
            href={`/player/matches/${m.id}`}
            className="block rounded-lg border border-zinc-200 bg-white px-4 py-4 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {m.group_name} · Round {m.round}
            </span>
            <span className="mt-1 block text-base font-semibold text-zinc-900">
              {m.home_team.name} vs {m.away_team.name}
            </span>
            <span className="mt-1 block text-sm text-zinc-600">
              {formatBrussels(m.datetime)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
