"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Membership = {
  id: string;
  player_id: string;
  player: { id: string; name: string; member_number?: string };
};

export default function ClubDetailPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [clubName, setClubName] = useState("");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const clubRes = await fetch(`/api/clubs/${clubId}`);
    if (clubRes.ok) {
      const clubBody = await clubRes.json();
      setClubName(clubBody.club?.name ?? "");
    }
    const res = await fetch(`/api/clubs/${clubId}/players`);
    if (res.ok) {
      const body = await res.json();
      setMemberships(body.memberships ?? []);
    }
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addPlayer() {
    const name = prompt("Player name");
    if (!name) return;
    const res = await fetch(`/api/clubs/${clubId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error ?? "Failed to add player");
      return;
    }
    setMessage(null);
    await load();
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-8">
      <Link href="/club-manager" className="text-sm text-zinc-600">
        ← My clubs
      </Link>
      <h1 className="text-2xl font-semibold">{clubName || "Club"}</h1>
      <p className="text-sm text-zinc-500">
        Membership changes are blocked once the season is active.
      </p>
      {message && <p className="text-sm text-red-600">{message}</p>}
      <button
        type="button"
        onClick={addPlayer}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
      >
        Add player
      </button>
      <ul className="flex flex-col gap-2 text-sm">
        {memberships.map((m) => (
          <li
            key={m.id}
            className="rounded border border-zinc-100 bg-white px-3 py-2"
          >
            {m.player?.name}
            {m.player?.member_number && (
              <span className="text-zinc-500"> · {m.player.member_number}</span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
