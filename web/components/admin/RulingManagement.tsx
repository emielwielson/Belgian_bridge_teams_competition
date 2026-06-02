"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type MatchOption = {
  id: string;
  round: number;
  datetime: string;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
};

type Ruling = {
  id: string;
  match_id: string;
  board: number | null;
  file_path: string;
  ruling_date: string | null;
  signed_url: string | null;
  match?: {
    round: number;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  } | null;
};

type Props = {
  groupId: string | null;
};

export function RulingManagement({ groupId }: Props) {
  const t = useTranslations("admin.rulings");
  const tCommon = useTranslations("common");
  const tPenalties = useTranslations("admin.penalties");
  const tMatchArbiter = useTranslations("match.arbiterRequest");

  const [rulings, setRulings] = useState<Ruling[]>([]);
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    match_id: "",
    board: "",
    ruling_date: new Date().toISOString().slice(0, 10),
    file: null as File | null,
  });

  function matchLabel(m: MatchOption): string {
    const home = m.home_team?.name ?? tCommon("home");
    const away = m.away_team?.name ?? tCommon("away");
    return tCommon("round", { round: m.round }) + `: ${home} ${tCommon("vs")} ${away}`;
  }

  const loadRulings = useCallback(async () => {
    if (!groupId) {
      setRulings([]);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/rulings?groupId=${groupId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("loadFailed"));
      setRulings(body.rulings ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  const loadMatches = useCallback(async () => {
    if (!groupId) {
      setMatches([]);
      return;
    }
    const res = await fetch(`/api/admin/groups/${groupId}/matches`);
    const body = await res.json();
    if (res.ok) {
      setMatches(body.matches ?? []);
      if (body.matches?.[0]?.id) {
        setForm((f) =>
          f.match_id ? f : { ...f, match_id: body.matches[0].id },
        );
      }
    }
  }, [groupId]);

  useEffect(() => {
    void loadRulings();
    void loadMatches();
  }, [loadRulings, loadMatches]);

  async function save() {
    if (!form.match_id || !form.file) {
      setMessage(t("matchFileRequired"));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const uploadData = new FormData();
      uploadData.append("file", form.file);
      uploadData.append("purpose", "ruling");
      uploadData.append("matchId", form.match_id);

      const uploadRes = await fetch("/api/files/upload", {
        method: "POST",
        body: uploadData,
      });
      const uploadBody = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadBody.error ?? tPenalties("saveFailed"));
      }

      const res = await fetch("/api/admin/rulings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: form.match_id,
          board:
            form.board.trim() !== "" && Number.isFinite(Number(form.board))
              ? Number(form.board)
              : null,
          file_path: uploadBody.path,
          ruling_date: form.ruling_date,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? tPenalties("saveFailed"));

      setForm({
        match_id: matches[0]?.id ?? "",
        board: "",
        ruling_date: new Date().toISOString().slice(0, 10),
        file: null,
      });
      await loadRulings();
      setMessage(t("added"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : tPenalties("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    const res = await fetch(`/api/admin/rulings/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? tPenalties("deleteFailed"));
      return;
    }
    await loadRulings();
    setMessage(t("removed"));
  }

  if (!groupId) {
    return <p className="text-sm text-zinc-600">{t("selectGroup")}</p>;
  }

  return (
    <section className="card mt-6">
      <h2 className="font-semibold text-zinc-900">{t("title")}</h2>
      <p className="mt-1 text-xs text-zinc-500">{t("description")}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
          {t("match")}
          <select
            value={form.match_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, match_id: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          >
            <option value="">{t("selectMatch")}</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {matchLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          {t("boardOptional")}
          <input
            type="number"
            min={1}
            value={form.board}
            onChange={(e) => setForm((f) => ({ ...f, board: e.target.value }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          {t("rulingDate")}
          <input
            type="date"
            value={form.ruling_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, ruling_date: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
          {t("file")}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                file: e.target.files?.[0] ?? null,
              }))
            }
            className="mt-1 w-full text-sm"
          />
        </label>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {busy ? t("uploading") : t("add")}
        </button>
      </div>

      {message ? (
        <p className="mt-2 text-sm text-zinc-700">{message}</p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-600">{tPenalties("loading")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 text-sm">
          {rulings.length === 0 ? (
            <li className="py-2 text-zinc-600">{t("none")}</li>
          ) : (
            rulings.map((r) => {
              const m = r.match;
              const label = m
                ? `${tCommon("round", { round: m.round })}: ${m.home_team?.name ?? "?"} ${tCommon("vs")} ${m.away_team?.name ?? "?"}${r.board != null ? ` — ${tMatchArbiter("board", { board: r.board })}` : ""}`
                : r.board != null
                  ? tMatchArbiter("board", { board: r.board })
                  : t("matchRuling");
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    {label}
                    {r.ruling_date ? ` (${r.ruling_date})` : ""}
                    {r.signed_url ? (
                      <>
                        {" "}
                        <a
                          href={r.signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-emerald-800 underline"
                        >
                          {t("viewFile")}
                        </a>
                      </>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium text-red-700 underline"
                    onClick={() => remove(r.id)}
                  >
                    {tCommon("delete")}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </section>
  );
}
