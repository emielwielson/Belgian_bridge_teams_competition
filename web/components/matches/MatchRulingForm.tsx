"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  FilePickerField,
  FILE_PICKER_ACCEPT,
} from "@/components/files/FilePickerField";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";

type HonorArbiterOption = {
  userId: string;
  label: string;
};

type RulingRow = {
  id: string;
  board: number | null;
  ruling_date: string | null;
  created_by_name?: string | null;
  signed_url: string | null;
};

type Props = {
  matchId: string;
};

export function MatchRulingForm({ matchId }: Props) {
  const t = useTranslations("match.ruling");
  const translateApiError = useTranslateApiError();
  const [rulings, setRulings] = useState<RulingRow[]>([]);
  const [canChooseArbiter, setCanChooseArbiter] = useState(false);
  const [honorArbiters, setHonorArbiters] = useState<HonorArbiterOption[]>([]);
  const [arbiterUserId, setArbiterUserId] = useState("");
  const [board, setBoard] = useState("");
  const [rulingDate, setRulingDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadRulings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/arbiter/rulings?matchId=${matchId}`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          translateApiError(body.error) ?? t("loadFailed"),
        );
      }
      setRulings(body.rulings ?? []);
      const choose = Boolean(body.canChooseArbiter);
      setCanChooseArbiter(choose);
      const arbiters = Array.isArray(body.honorArbiters)
        ? (body.honorArbiters as HonorArbiterOption[])
        : [];
      setHonorArbiters(arbiters);
      setArbiterUserId((prev) => {
        if (!choose) return "";
        if (prev && arbiters.some((a) => a.userId === prev)) return prev;
        return arbiters[0]?.userId ?? "";
      });
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : t("loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [matchId, t, translateApiError]);

  useEffect(() => {
    void loadRulings();
  }, [loadRulings]);

  async function submit() {
    if (!file) {
      setMessage(t("fileRequired"));
      return;
    }
    if (canChooseArbiter && !arbiterUserId) {
      setMessage(t("arbiterRequired"));
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("purpose", "ruling");
      uploadData.append("matchId", matchId);

      const uploadRes = await fetch("/api/files/upload", {
        method: "POST",
        body: uploadData,
      });
      const uploadBody = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(
          translateApiError(uploadBody.error) ?? t("uploadFailed"),
        );
      }

      const res = await fetch("/api/arbiter/rulings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: matchId,
          board:
            board.trim() !== "" && Number.isFinite(Number(board))
              ? Number(board)
              : null,
          file_path: uploadBody.path,
          ruling_date: rulingDate || null,
          ...(canChooseArbiter ? { arbiter_user_id: arbiterUserId } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(translateApiError(body.error) ?? t("saveFailed"));
      }

      setBoard("");
      setRulingDate(new Date().toISOString().slice(0, 10));
      setFile(null);
      setFileInputKey((k) => k + 1);
      await loadRulings();
      setMessage(t("saved"));
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : t("saveFailedGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{t("title")}</h3>
      <p className="mt-1 text-xs text-zinc-500">{t("description")}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {canChooseArbiter ? (
          <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
            {t("arbiter")}
            <select
              value={arbiterUserId}
              onChange={(e) => setArbiterUserId(e.target.value)}
              disabled={busy || honorArbiters.length === 0}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
            >
              {honorArbiters.length === 0 ? (
                <option value="">{t("noHonorArbiters")}</option>
              ) : (
                honorArbiters.map((arb) => (
                  <option key={arb.userId} value={arb.userId}>
                    {arb.label}
                  </option>
                ))
              )}
            </select>
            <span className="mt-1 block text-[11px] font-normal text-zinc-500">
              {t("arbiterHint")}
            </span>
          </label>
        ) : null}
        <label className="block text-xs font-medium text-zinc-600">
          {t("boardOptional")}
          <input
            type="number"
            min={1}
            value={board}
            onChange={(e) => setBoard(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          {t("rulingDate")}
          <input
            type="date"
            value={rulingDate}
            onChange={(e) => setRulingDate(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
          />
        </label>
        <div className="sm:col-span-2">
          <FilePickerField
            key={fileInputKey}
            id="match-ruling-file"
            file={file}
            onFileChange={setFile}
            hint={t("file")}
            accept={FILE_PICKER_ACCEPT}
            disabled={busy}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy || (canChooseArbiter && honorArbiters.length === 0)}
        className="btn-primary mt-4 text-sm disabled:opacity-50"
      >
        {busy ? t("saving") : t("add")}
      </button>

      {message ? <p className="mt-2 text-xs text-zinc-700">{message}</p> : null}

      <div className="mt-4 border-t border-zinc-100 pt-3">
        <h4 className="text-xs font-semibold text-zinc-800">{t("listTitle")}</h4>
        {loading ? (
          <p className="mt-2 text-xs text-zinc-500">{t("loading")}</p>
        ) : rulings.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">{t("none")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100">
            {rulings.map((ruling) => (
              <li
                key={ruling.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
              >
                <span className="text-zinc-700">
                  {ruling.ruling_date ?? "—"}
                  {ruling.board != null
                    ? t("boardLabel", { board: ruling.board })
                    : ""}
                  {" · "}
                  {t("byArbiter", {
                    name:
                      ruling.created_by_name?.trim() || t("byArbiterUnknown"),
                  })}
                </span>
                {ruling.signed_url ? (
                  <a
                    href={ruling.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    {t("viewFile")}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
