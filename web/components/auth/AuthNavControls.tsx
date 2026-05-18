"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MeResponse = {
  user: { id: string; email?: string };
  roles: string[];
  teams?: { id: string; name: string }[];
};

export function AuthNavControls() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<MeResponse>;
      })
      .then((data) => setMe(data))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <nav className="text-sm text-zinc-500">…</nav>;
  }

  if (!me) {
    return (
      <nav className="flex items-center gap-3 text-sm">
        <Link href="/standings" className="text-zinc-600 hover:text-zinc-900">
          Standings
        </Link>
        <Link
          href="/login"
          className="rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700"
        >
          Sign in
        </Link>
      </nav>
    );
  }

  const hub =
    me.roles.includes("system_admin") || me.roles.includes("competition_manager")
      ? "/admin"
      : me.roles.includes("player")
        ? "/player"
        : me.roles.includes("captain")
          ? "/captain"
          : me.roles.includes("club_manager")
            ? "/club-manager"
            : me.roles.includes("arbiter")
              ? "/arbiter"
              : null;

  return (
    <nav className="flex flex-wrap items-center gap-3 text-sm">
      <Link href="/standings" className="text-zinc-600 hover:text-zinc-900">
        Standings
      </Link>
      {me.teams?.length === 1 ? (
        <Link
          href={`/teams/${me.teams[0].id}`}
          className="text-zinc-600 hover:text-zinc-900"
        >
          My team
        </Link>
      ) : null}
      {hub && (
        <Link href={hub} className="text-zinc-600 hover:text-zinc-900">
          Dashboard
        </Link>
      )}
      <span className="text-zinc-500">{me.user.email}</span>
      <form action="/api/auth/signout" method="post">
        <button
          type="submit"
          className="text-zinc-600 underline hover:text-zinc-900"
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
