"use client";

import { useState } from "react";

type Props = {
  matchId: string;
  boardCount: number;
  initialImpsHome: number | null;
  initialImpsAway: number | null;
  initialVpHome: number | null;
  initialVpAway: number | null;
  playedAt: string | null;
  isAdmin: boolean;
};

export function MatchScoreForm({
  matchId,
  boardCount,
  initialImpsHome,
  initialImpsAway,
  initialVpHome,
  initialVpAway,
  playedAt,
  isAdmin,
}: Props) {
  const [impsHome, setImpsHome] = useState(
    initialImpsHome != null ? String(initialImpsHome) : "",
  );
  const [impsAway, setImpsAway] = useState(
    initialImpsAway != null ? String(initialImpsAway) : "",
  );
  const [saving, setSaving] = useState(false);
  const [vpHome, setVpHome] = useState<number | null>(initialVpHome);
  const [vpAway, setVpAway] = useState<number | null>(initialVpAway);
  const [locked, setLocked] = useState(playedAt != null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !locked;
  const canAdminEdit = locked && isAdmin;

  async function submit(method: "POST" | "PATCH") {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/score`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imps_home: Number(impsHome),
          imps_away: Number(impsAway),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to submit score");
      setVpHome(body.match.vp_home);
      setVpAway(body.match.vp_away);
      setLocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  if (locked && !canAdminEdit) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h3 className="text-sm font-semibold text-zinc-900">Official score</h3>
        <p className="mt-2 text-sm text-zinc-700">
          IMPs: {initialImpsHome ?? impsHome} – {initialImpsAway ?? impsAway}
        </p>
        {vpHome != null && vpAway != null ? (
          <p className="mt-1 text-sm text-zinc-700">
            VP: {vpHome} – {vpAway}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-500">
          Score is locked. Contact a competition manager to change it.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">
        {canAdminEdit ? "Admin score edit" : "Submit score"}
      </h3>
      <p className="mt-1 text-xs text-zinc-500">{boardCount} boards · VP from table</p>
      <ScoreImpsInputs
        impsHome={impsHome}
        impsAway={impsAway}
        setImpsHome={setImpsHome}
        setImpsAway={setImpsAway}
        disabled={saving}
      />
      {canSubmit ? (
        <button
          type="button"
          onClick={() => submit("POST")}
          disabled={saving || impsHome === "" || impsAway === ""}
          className="mt-4 w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Submitting…" : "Submit official score"}
        </button>
      ) : null}
      {canAdminEdit ? (
        <button
          type="button"
          onClick={() => submit("PATCH")}
          disabled={saving || impsHome === "" || impsAway === ""}
          className="mt-4 w-full rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Overwrite official score"}
        </button>
      ) : null}
      {vpHome != null && vpAway != null && locked ? (
        <p className="mt-2 text-sm text-emerald-700">
          VP: {vpHome} – {vpAway}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}

function ScoreImpsInputs({
  impsHome,
  impsAway,
  setImpsHome,
  setImpsAway,
  disabled,
}: {
  impsHome: string;
  impsAway: string;
  setImpsHome: (v: string) => void;
  setImpsAway: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <label className="block text-xs font-medium text-zinc-600">
        Home IMPs
        <input
          type="number"
          inputMode="numeric"
          value={impsHome}
          disabled={disabled}
          onChange={(e) => setImpsHome(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600">
        Away IMPs
        <input
          type="number"
          inputMode="numeric"
          value={impsAway}
          disabled={disabled}
          onChange={(e) => setImpsAway(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
        />
      </label>
    </div>
  );
}
