"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LanguageSelect } from "@/components/i18n/LanguageSelect";
import type { ActivePlayer, LinkedPlayer } from "@/lib/auth/active-player";

type Props = {
  email?: string;
  activePlayer?: ActivePlayer | null;
  linkedPlayers?: LinkedPlayer[];
};

function displayInitial(email: string | undefined, activePlayer?: ActivePlayer | null): string {
  if (activePlayer?.name) {
    return activePlayer.name.charAt(0).toUpperCase();
  }
  if (!email) return "?";
  const local = email.split("@")[0]?.trim();
  if (!local) return "?";
  return local.charAt(0).toUpperCase();
}

function displayLabel(email: string | undefined, activePlayer?: ActivePlayer | null): string {
  if (activePlayer?.name) return activePlayer.name;
  if (!email) return "";
  return email.split("@")[0] ?? "";
}

export function AccountMenu({ email, activePlayer, linkedPlayers = [] }: Props) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const signedIn = Boolean(email);
  const showProfileSwitcher = signedIn && linkedPlayers.length > 1;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function switchPlayer(playerId: string) {
    if (playerId === activePlayer?.id || switchingId) return;
    setSwitchingId(playerId);
    try {
      const res = await fetch("/api/auth/active-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={signedIn ? (activePlayer?.name ?? email) : t("signIn")}
        className="flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-200"
      >
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white"
        >
          {signedIn ? displayInitial(email, activePlayer) : "?"}
        </span>
        {signedIn ? (
          <span className="hidden max-w-[7rem] truncate text-sm text-zinc-700 sm:inline">
            {displayLabel(email, activePlayer)}
          </span>
        ) : null}
        <span aria-hidden className="text-xs text-zinc-400">
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-56 rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {signedIn ? (
            <p className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500">
              {email}
            </p>
          ) : null}

          {showProfileSwitcher ? (
            <div className="border-b border-zinc-100 px-3 py-2" role="none">
              <p className="mb-2 text-xs font-medium text-zinc-500">
                {t("playingAs")}
              </p>
              <ul className="flex flex-col gap-1">
                {linkedPlayers.map((player) => {
                  const isActive = player.id === activePlayer?.id;
                  return (
                    <li key={player.id}>
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        disabled={switchingId !== null}
                        onClick={() => switchPlayer(player.id)}
                        className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                          isActive
                            ? "bg-emerald-50 font-medium text-emerald-900"
                            : "text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        {player.name}
                        {player.club_name ? (
                          <span className="block text-xs text-zinc-500">
                            {player.club_name}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div
            className={`px-3 py-2 ${signedIn ? "border-b border-zinc-100" : ""}`}
            role="none"
          >
            <LanguageSelect id="locale-account-menu" />
          </div>

          {signedIn ? (
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
              >
                {t("signOut")}
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              role="menuitem"
              className="block px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              onClick={() => setOpen(false)}
            >
              {t("signIn")}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
