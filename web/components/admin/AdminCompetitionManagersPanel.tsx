"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CompetitionKindCode } from "@/lib/auth/competition-scope";

type ManagerRow = {
  userId: string;
  email: string | null;
  displayName: string | null;
  playerName: string | null;
  kinds: CompetitionKindCode[];
  isGlobal: boolean;
};

const KIND_OPTIONS: CompetitionKindCode[] = [
  "national",
  "flanders",
  "wallonia",
  "zweiffel",
];

export function AdminCompetitionManagersPanel() {
  const t = useTranslations("admin");
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [createKinds, setCreateKinds] = useState<CompetitionKindCode[]>([
    "zweiffel",
  ]);
  const [createGlobal, setCreateGlobal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/competition-managers");
    if (res.ok) {
      const body = await res.json();
      setManagers(
        (body.managers ?? []).map((row: ManagerRow) => ({
          ...row,
          displayName: row.displayName ?? null,
        })),
      );
    } else {
      setManagers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleKind(
    list: CompetitionKindCode[],
    code: CompetitionKindCode,
  ): CompetitionKindCode[] {
    return list.includes(code)
      ? list.filter((k) => k !== code)
      : [...list, code];
  }

  async function createManager() {
    if (!displayName.trim()) {
      setMessage(t("competitionManagersPage.nameRequired"));
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/competition-managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        displayName: displayName.trim(),
        kinds: createGlobal ? [] : createKinds,
        isGlobal: createGlobal,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? t("competitionManagersPage.createFailed"));
      setSaving(false);
      return;
    }
    setEmail("");
    setDisplayName("");
    setCreateGlobal(false);
    setCreateKinds(["zweiffel"]);
    setMessage(t("competitionManagersPage.created"));
    setSaving(false);
    await load();
  }

  async function saveRow(row: ManagerRow) {
    if (!row.displayName?.trim()) {
      setMessage(t("competitionManagersPage.nameRequired"));
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/admin/competition-managers/${row.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: row.displayName.trim(),
        kinds: row.isGlobal ? [] : row.kinds,
        isGlobal: row.isGlobal,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? t("competitionManagersPage.saveFailed"));
      setSaving(false);
      return;
    }
    setMessage(t("competitionManagersPage.saved"));
    setSaving(false);
    await load();
  }

  async function removeRow(userId: string) {
    if (!window.confirm(t("competitionManagersPage.removeConfirm"))) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/admin/competition-managers/${userId}`, {
      method: "DELETE",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? t("competitionManagersPage.removeFailed"));
      setSaving(false);
      return;
    }
    setMessage(t("competitionManagersPage.removed"));
    setSaving(false);
    await load();
  }

  function updateLocal(
    userId: string,
    patch: Partial<Pick<ManagerRow, "kinds" | "isGlobal" | "displayName">>,
  ) {
    setManagers((rows) =>
      rows.map((r) => (r.userId === userId ? { ...r, ...patch } : r)),
    );
  }

  function kindLabel(code: CompetitionKindCode): string {
    if (code === "national") return t("competitionManagersPage.kindNational");
    if (code === "flanders") return t("competitionManagersPage.kindFlanders");
    if (code === "zweiffel") return t("competitionManagersPage.kindZweiffel");
    return t("competitionManagersPage.kindWallonia");
  }

  return (
    <div className="flex flex-col gap-8">
      {message ? (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 border-b border-zinc-200 pb-8">
        <h2 className="text-lg font-medium text-zinc-900">
          {t("competitionManagersPage.addTitle")}
        </h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">{t("competitionManagersPage.name")}</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">{t("competitionManagersPage.email")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
            autoComplete="off"
          />
        </label>
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 w-full text-zinc-600">
            {t("competitionManagersPage.scopes")}
          </legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={createGlobal}
              onChange={(e) => setCreateGlobal(e.target.checked)}
            />
            {t("competitionManagersPage.global")}
          </label>
          {KIND_OPTIONS.map((code) => (
            <label
              key={code}
              className={`flex items-center gap-2 ${
                createGlobal ? "opacity-50" : ""
              }`}
            >
              <input
                type="checkbox"
                disabled={createGlobal}
                checked={!createGlobal && createKinds.includes(code)}
                onChange={() =>
                  setCreateKinds((prev) => toggleKind(prev, code))
                }
              />
              {kindLabel(code)}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className="btn-primary w-fit"
          disabled={
            saving ||
            !email.trim() ||
            !displayName.trim() ||
            (!createGlobal && createKinds.length === 0)
          }
          onClick={() => void createManager()}
        >
          {t("competitionManagersPage.add")}
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-zinc-900">
          {t("competitionManagersPage.listTitle")}
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-600">
            {t("competitionManagersPage.loading")}
          </p>
        ) : managers.length === 0 ? (
          <p className="text-sm text-zinc-600">
            {t("competitionManagersPage.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {managers.map((row) => (
              <li
                key={row.userId}
                className="flex flex-col gap-3 border border-zinc-200 p-4"
              >
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600">
                    {t("competitionManagersPage.name")}
                  </span>
                  <input
                    type="text"
                    value={row.displayName ?? ""}
                    disabled={saving}
                    onChange={(e) =>
                      updateLocal(row.userId, { displayName: e.target.value })
                    }
                    className="rounded border border-zinc-300 px-3 py-2 font-medium text-zinc-900"
                  />
                </label>
                <div>
                  <p className="text-sm text-zinc-600">
                    {row.email ?? row.userId}
                  </p>
                  {row.playerName ? (
                    <p className="text-sm text-zinc-600">
                      {t("competitionManagersPage.linkedPlayer", {
                        name: row.playerName,
                      })}
                    </p>
                  ) : null}
                  {row.isGlobal ? (
                    <p className="text-sm text-zinc-600">
                      {t("competitionManagersPage.globalBadge")}
                    </p>
                  ) : null}
                </div>
                <fieldset className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={saving}
                      checked={row.isGlobal}
                      onChange={(e) =>
                        updateLocal(row.userId, {
                          isGlobal: e.target.checked,
                          kinds: e.target.checked ? [] : row.kinds,
                        })
                      }
                    />
                    {t("competitionManagersPage.global")}
                  </label>
                  {KIND_OPTIONS.map((code) => (
                    <label
                      key={code}
                      className={`flex items-center gap-2 ${
                        row.isGlobal ? "opacity-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={row.isGlobal || saving}
                        checked={!row.isGlobal && row.kinds.includes(code)}
                        onChange={() =>
                          updateLocal(row.userId, {
                            kinds: toggleKind(row.kinds, code),
                          })
                        }
                      />
                      {kindLabel(code)}
                    </label>
                  ))}
                </fieldset>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={
                      saving || (!row.isGlobal && row.kinds.length === 0)
                    }
                    onClick={() => void saveRow(row)}
                  >
                    {t("competitionManagersPage.save")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-red-700"
                    disabled={saving}
                    onClick={() => void removeRow(row.userId)}
                  >
                    {t("competitionManagersPage.remove")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
