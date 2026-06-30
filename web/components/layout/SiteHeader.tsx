"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { ARBITER_ACCESS_ROLES, hasAnyRole } from "@/lib/auth/roles";
import type { ActivePlayer, LinkedPlayer } from "@/lib/auth/active-player";

type MeResponse = {
  user: { id: string; email?: string };
  roles: string[];
  teams?: { id: string; name: string }[];
  activePlayer?: ActivePlayer | null;
  linkedPlayers?: LinkedPlayer[];
};

function navLinkClass(active: boolean): string {
  return active
    ? "text-sm font-medium text-zinc-900"
    : "text-sm font-medium text-zinc-600 hover:text-zinc-900";
}

function mobileLinkClass(active: boolean): string {
  return active
    ? "whitespace-nowrap text-sm font-medium text-zinc-900"
    : "whitespace-nowrap text-sm font-medium text-zinc-600";
}

export function SiteHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (!res.ok) {
      setMe(null);
      return;
    }
    const data = (await res.json()) as MeResponse;
    setMe(data);
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoaded(true));
  }, [refreshMe]);

  const showAdminDashboard =
    me?.roles.includes("system_admin") ||
    me?.roles.includes("competition_manager");
  const showArbiterInbox = me
    ? hasAnyRole(me.roles, [...ARBITER_ACCESS_ROLES])
    : false;

  const primaryLinks = (
    <>
      <Link
        href="/"
        className={navLinkClass(
          pathname === "/" || pathname.startsWith("/standings"),
        )}
      >
        {t("standings")}
      </Link>
      {me?.teams?.length === 1 ? (
        <Link
          href={`/teams/${me.teams[0].id}`}
          className={navLinkClass(pathname.startsWith("/teams/"))}
        >
          {t("myTeam")}
        </Link>
      ) : null}
      {me ? (
        <Link
          href="/manuals"
          className={navLinkClass(pathname.startsWith("/manuals"))}
        >
          {t("manuals")}
        </Link>
      ) : null}
      {showArbiterInbox ? (
        <Link
          href="/arbiter"
          className={navLinkClass(pathname.startsWith("/arbiter"))}
        >
          {t("arbiterInbox")}
        </Link>
      ) : null}
      {showAdminDashboard ? (
        <Link
          href="/admin"
          className={navLinkClass(pathname.startsWith("/admin"))}
        >
          {t("dashboard")}
        </Link>
      ) : null}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-6 px-4">
        <nav className="hidden min-w-0 flex-1 items-center gap-x-4 gap-y-1 overflow-hidden sm:flex sm:flex-wrap">
          {!loaded ? (
            <span className="text-sm text-zinc-400">{t("loading")}</span>
          ) : (
            primaryLinks
          )}
        </nav>

        <div className="ml-auto shrink-0 pl-2">
          {!loaded ? (
            <span className="inline-block h-9 w-9 animate-pulse rounded-md bg-zinc-100" />
          ) : (
            <AccountMenu
              email={me?.user.email}
              activePlayer={me?.activePlayer}
              linkedPlayers={me?.linkedPlayers}
              onPlayerSwitched={refreshMe}
            />
          )}
        </div>
      </div>

      {loaded ? (
        <nav className="flex gap-4 overflow-x-auto border-t border-zinc-100 px-4 py-2 sm:hidden">
          <Link
            href="/"
            className={mobileLinkClass(
              pathname === "/" || pathname.startsWith("/standings"),
            )}
          >
            {t("standings")}
          </Link>
          {me ? (
            <Link
              href="/manuals"
              className={mobileLinkClass(pathname.startsWith("/manuals"))}
            >
              {t("manuals")}
            </Link>
          ) : null}
          {showArbiterInbox ? (
            <Link
              href="/arbiter"
              className={mobileLinkClass(pathname.startsWith("/arbiter"))}
            >
              {t("arbiterInbox")}
            </Link>
          ) : null}
          {showAdminDashboard ? (
            <Link
              href="/admin"
              className={mobileLinkClass(pathname.startsWith("/admin"))}
            >
              {t("dashboard")}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
