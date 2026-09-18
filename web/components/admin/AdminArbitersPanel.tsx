"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CompetitionKindCode } from "@/lib/auth/competition-scope";

type ArbiterRow = {
  userId: string;
  email: string | null;
  playerName: string | null;
  kinds: CompetitionKindCode[];
  honor: boolean;
};

const KIND_OPTIONS: CompetitionKindCode[] = [
  "national",
  "flanders",
  "wallonia",
];

export function AdminArbitersPanel() {
  const t = useTranslations("admin");
  const [arbiters, setArbiters] = useState<ArbiterRow[]>([]);
  const [managedKinds, setManagedKinds] = useState<CompetitionKindCode[]>([]);
  const [canGrantHonor, setCanGrantHonor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [createKinds, setCreateKinds] = useState<CompetitionKindCode[]>([]);
  const [createHonor, setCreateHonor] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/arbiters");
    if (res.ok) {
      const body = await res.json();
      setArbiters(body.arbiters ?? []);
      setManagedKinds(body.managedKinds ?? []);
      setCanGrantHonor(Boolean(body.canGrantHonor));
      setCreateKinds((prev) =>
        prev.length === 0 && (body.managedKinds?.length ?? 0) > 0
          ? [body.managedKinds[0] as CompetitionKindCode]
          : prev,
      );
    } else {
      setArbiters([]);
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

  async function createArbiter() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/arbiters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        kinds: createKinds,
        honor: createHonor,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? t("arbitersPage.createFailed"));
      setSaving(false);
      return;
    }
    setEmail("");
    setCreateHonor(false);
    setMessage(t("arbitersPage.created"));
    setSaving(false);
    await load();
  }

  async function saveRow(row: ArbiterRow) {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/admin/arbiters/${row.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kinds: row.kinds, honor: row.honor }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? t("arbitersPage.saveFailed"));
      setSaving(false);
      return;
    }
    setMessage(t("arbitersPage.saved"));
    setSaving(false);
    await load();
  }

  async function removeRow(userId: string) {
    if (!window.confirm(t("arbitersPage.removeConfirm"))) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/admin/arbiters/${userId}`, {
      method: "DELETE",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? t("arbitersPage.removeFailed"));
      setSaving(false);
      return;
    }
    setMessage(t("arbitersPage.removed"));
    setSaving(false);
    await load();
  }

  function updateLocal(
    userId: string,
    patch: Partial<Pick<ArbiterRow, "kinds" | "honor">>,
  ) {
    setArbiters((rows) =>
      rows.map((r) => (r.userId === userId ? { ...r, ...patch } : r)),
    );
  }

  function kindLabel(code: CompetitionKindCode): string {
    if (code === "national") return t("arbitersPage.kindNational");
    if (code === "flanders") return t("arbitersPage.kindFlanders");
    return t("arbitersPage.kindWallonia");
  }

  return (
    <div className="flex flex-col gap-8">
      {message ? (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 border-b border-zinc-200 pb-8">
        <h2 className="text-lg font-medium text-zinc-900">{t("arbitersPage.addTitle")}</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">{t("arbitersPage.email")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
            autoComplete="off"
          />
        </label>
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 w-full text-zinc-600">{t("arbitersPage.scopes")}</legend>
          {KIND_OPTIONS.filter((k) => managedKinds.includes(k)).map((code) => (
            <label key={code} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={createKinds.includes(code)}
                onChange={() =>
                  setCreateKinds((prev) => toggleKind(prev, code))
                }
              />
              {kindLabel(code)}
            </label>
          ))}
          {canGrantHonor ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={createHonor}
                onChange={(e) => setCreateHonor(e.target.checked)}
              />
              {t("arbitersPage.honor")}
            </label>
          ) : null}
        </fieldset>
        <button
          type="button"
          className="btn-primary w-fit"
          disabled={saving || !email.trim()}
          onClick={() => void createArbiter()}
        >
          {t("arbitersPage.add")}
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-zinc-900">{t("arbitersPage.listTitle")}</h2>
        {loading ? (
          <p className="text-sm text-zinc-600">{t("arbitersPage.loading")}</p>
        ) : arbiters.length === 0 ? (
          <p className="text-sm text-zinc-600">{t("arbitersPage.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {arbiters.map((row) => (
              <li
                key={row.userId}
                className="flex flex-col gap-3 border border-zinc-200 p-4"
              >
                <div>
                  <p className="font-medium text-zinc-900">
                    {row.email ?? row.userId}
                  </p>
                  {row.playerName ? (
                    <p className="text-sm text-zinc-600">
                      {t("arbitersPage.linkedPlayer", { name: row.playerName })}
                    </p>
                  ) : null}
                </div>
                <fieldset className="flex flex-wrap gap-4 text-sm">
                  {KIND_OPTIONS.map((code) => {
                    const editable = managedKinds.includes(code);
                    return (
                      <label
                        key={code}
                        className={`flex items-center gap-2 ${
                          editable ? "" : "opacity-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!editable || saving}
                          checked={row.kinds.includes(code)}
                          onChange={() =>
                            updateLocal(row.userId, {
                              kinds: toggleKind(row.kinds, code),
                            })
                          }
                        />
                        {kindLabel(code)}
                      </label>
                    );
                  })}
                  <label
                    className={`flex items-center gap-2 ${
                      canGrantHonor ? "" : "opacity-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!canGrantHonor || saving}
                      checked={row.honor}
                      onChange={(e) =>
                        updateLocal(row.userId, { honor: e.target.checked })
                      }
                    />
                    {t("arbitersPage.honor")}
                  </label>
                </fieldset>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={saving}
                    onClick={() => void saveRow(row)}
                  >
                    {t("arbitersPage.save")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-red-700"
                    disabled={saving}
                    onClick={() => void removeRow(row.userId)}
                  >
                    {t("arbitersPage.remove")}
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
