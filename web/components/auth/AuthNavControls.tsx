"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ARBITER_ACCESS_ROLES, hasAnyRole } from "@/lib/auth/roles";

type MeResponse = {
  user: { id: string; email?: string };
  roles: string[];
  teams?: { id: string; name: string }[];
  clubs?: { id: string; name: string }[];
};

export function AuthNavControls() {
  const t = useTranslations("nav");
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
    return <nav className="text-sm text-zinc-500">{t("loading")}</nav>;
  }

  if (!me) {
    return (
      <nav className="flex items-center gap-3 text-sm">
        <Link href="/standings" className="text-zinc-600 hover:text-zinc-900">
          {t("standings")}
        </Link>
        <Link
          href="/login"
          className="rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700"
        >
          {t("signIn")}
        </Link>
      </nav>
    );
  }

  const showAdminDashboard =
    me.roles.includes("system_admin") ||
    me.roles.includes("competition_manager");
  const showArbiterInbox = hasAnyRole(me.roles, [...ARBITER_ACCESS_ROLES]);

  return (
    <nav className="flex flex-wrap items-center gap-3 text-sm">
      <Link href="/standings" className="text-zinc-600 hover:text-zinc-900">
        {t("standings")}
      </Link>
      {me.teams?.length === 1 ? (
        <Link
          href={`/teams/${me.teams[0].id}`}
          className="text-zinc-600 hover:text-zinc-900"
        >
          {t("myTeam")}
        </Link>
      ) : null}
      {me.clubs?.length === 1 ? (
        <Link
          href={`/club-manager/${me.clubs[0].id}`}
          className="text-zinc-600 hover:text-zinc-900"
        >
          {t("myClub")}
        </Link>
      ) : me.clubs && me.clubs.length > 1 ? (
        <Link href="/club-manager" className="text-zinc-600 hover:text-zinc-900">
          {t("myClubs")}
        </Link>
      ) : null}
      {showArbiterInbox ? (
        <Link href="/arbiter" className="text-zinc-600 hover:text-zinc-900">
          {t("arbiterInbox")}
        </Link>
      ) : null}
      {showAdminDashboard ? (
        <Link href="/admin" className="text-zinc-600 hover:text-zinc-900">
          {t("dashboard")}
        </Link>
      ) : null}
      <span className="text-zinc-500">{me.user.email}</span>
      <form action="/api/auth/signout" method="post">
        <button
          type="submit"
          className="text-zinc-600 underline hover:text-zinc-900"
        >
          {t("signOut")}
        </button>
      </form>
    </nav>
  );
}
