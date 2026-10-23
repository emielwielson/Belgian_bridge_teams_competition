"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ForfaitSide } from "@/lib/scoring/forfait";

type Props = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  forfaitSide: ForfaitSide | null;
  canManage: boolean;
};

export function ForfaitWorkflow({
  matchId,
  homeTeamName,
  awayTeamName,
  forfaitSide,
  canManage,
}: Props) {
  const t = useTranslations("match.forfait");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function apply(side: ForfaitSide) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/forfait`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body.message === "string" ? body.message : t("applyFailed"),
        );
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(t("applyFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/forfait`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body.message === "string" ? body.message : t("clearFailed"),
        );
        return;
      }
      router.refresh();
    } catch {
      setError(t("clearFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (forfaitSide) {
    const forfeiter =
      forfaitSide === "home" ? homeTeamName : awayTeamName;
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-950">
          {t("activeBanner", { team: forfeiter })}
        </p>
        <p className="mt-1 text-sm text-amber-900">{t("activeHint")}</p>
        {canManage ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => void clear()}
            >
              {busy ? t("clearing") : t("clear")}
            </button>
            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  if (!canManage) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          className={`text-sm ${open ? "btn-primary" : "btn-secondary"}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? t("hide") : t("record")}
        </button>
      </div>
      {open ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">{t("title")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => void apply("home")}
            >
              {t("homeForfeits", { team: homeTeamName })}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => void apply("away")}
            >
              {t("awayForfeits", { team: awayTeamName })}
            </button>
          </div>
          {error ? (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
