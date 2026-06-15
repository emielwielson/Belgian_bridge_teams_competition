"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { LinkedPlayer } from "@/lib/auth/active-player";

type Props = {
  players: LinkedPlayer[];
  nextPath: string;
};

export function PlayerSelectForm({ players, nextPath }: Props) {
  const t = useTranslations("auth.selectPlayer");
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(players[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId) return;

    setStatus("loading");
    setMessage(null);

    const res = await fetch("/api/auth/active-player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: selectedId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setMessage((body.error as string) ?? t("failed"));
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card flex max-w-md flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t("title")}</legend>
        {players.map((player) => (
          <label
            key={player.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-3 py-3 hover:border-emerald-300 has-checked:border-emerald-500 has-checked:bg-emerald-50/40"
          >
            <input
              type="radio"
              name="player"
              value={player.id}
              checked={selectedId === player.id}
              onChange={() => setSelectedId(player.id)}
              className="mt-1"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-zinc-900">{player.name}</span>
              {player.member_number ? (
                <span className="text-sm text-zinc-600">
                  {t("memberNumber", { number: player.member_number })}
                </span>
              ) : null}
              {player.club_name ? (
                <span className="text-sm text-zinc-500">{player.club_name}</span>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>
      <button
        type="submit"
        disabled={status === "loading" || !selectedId}
        className="btn-primary w-full"
      >
        {status === "loading" ? t("confirming") : t("confirm")}
      </button>
      {message ? (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      ) : null}
    </form>
  );
}
