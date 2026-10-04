"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CompetitionKindCode } from "@/lib/auth/competition-scope";

type ArbiterRow = {
  userId: string;
  email: string | null;
  displayName: string | null;
  playerName: string | null;
  kinds: CompetitionKindCode[];
  chiefKinds: CompetitionKindCode[];
  honor: boolean;
};

const KIND_OPTIONS: CompetitionKindCode[] = [
  "national",
  "flanders",
  "wallonia",
  "zweiffel",
];

export function AdminArbitersPanel() {
  const t = useTranslations("admin");
  const [arbiters, setArbiters] = useState<ArbiterRow[]>([]);
  const [managedKinds, setManagedKinds] = useState<CompetitionKindCode[]>([]);
  const [canGrantHonor, setCanGrantHonor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [createKinds, setCreateKinds] = useState<CompetitionKindCode[]>([]);
  const [createChiefKinds, setCreateChiefKinds] = useState<
    CompetitionKindCode[]
  >([]);
  const [createHonor, setCreateHonor] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/arbiters");
    if (res.ok) {
      const body = await res.json();
      setArbiters(
        (body.arbiters ?? []).map(
          (row: ArbiterRow): ArbiterRow => ({
            ...row,
            displayName: row.displayName ?? null,
            chiefKinds: Array.isArray(row.chiefKinds) ? row.chiefKinds : [],
          }),
        ),
      );
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

  function toggleChief(
    list: CompetitionKindCode[],
    code: CompetitionKindCode,
    scoped: CompetitionKindCode[],
  ): CompetitionKindCode[] {
    if (!scoped.includes(code)) return list.filter((k) => k !== code);
    return list.includes(code)
      ? list.filter((k) => k !== code)
      : [...list, code];
  }

  async function createArbiter() {
    if (!displayName.trim()) {
      setMessage(t("arbitersPage.nameRequired"));
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/arbiters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        displayName: displayName.trim(),
        kinds: createKinds,
        chiefKinds: createChiefKinds.filter((c) => createKinds.includes(c)),
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
    setDisplayName("");
    setCreateHonor(false);
    setCreateChiefKinds([]);
    setMessage(t("arbitersPage.created"));
    setSaving(false);
    await load();
  }

  async function saveRow(row: ArbiterRow) {
    if (!row.displayName?.trim()) {
      setMessage(t("arbitersPage.nameRequired"));
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/admin/arbiters/${row.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: row.displayName.trim(),
        kinds: row.kinds,
        chiefKinds: row.chiefKinds.filter((c) => row.kinds.includes(c)),
        honor: row.honor,
      }),
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
    patch: Partial<
      Pick<ArbiterRow, "kinds" | "chiefKinds" | "honor" | "displayName">
    >,
  ) {
    setArbiters((rows) =>
      rows.map((r) => {
        if (r.userId !== userId) return r;
        const next = { ...r, ...patch };
        if (patch.kinds) {
          next.chiefKinds = next.chiefKinds.filter((c) =>
            next.kinds.includes(c),
          );
        }
        return next;
      }),
    );
  }

  function kindLabel(code: CompetitionKindCode): string {
    if (code === "national") return t("arbitersPage.kindNational");
    if (code === "flanders") return t("arbitersPage.kindFlanders");
    if (code === "zweiffel") return t("arbitersPage.kindZweiffel");
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
          <span className="text-zinc-600">{t("arbitersPage.name")}</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
            autoComplete="off"
          />
        </label>
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
                onChange={() => {
                  setCreateKinds((prev) => {
                    const next = toggleKind(prev, code);
                    setCreateChiefKinds((chiefs) =>
                      chiefs.filter((c) => next.includes(c)),
                    );
                    return next;
                  });
                }}
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
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 w-full text-zinc-600">
            {t("arbitersPage.chiefScopes")}
          </legend>
          <p className="w-full text-xs text-zinc-500">
            {t("arbitersPage.chiefHint")}
          </p>
          {KIND_OPTIONS.filter((k) => managedKinds.includes(k)).map((code) => (
            <label
              key={`chief-create-${code}`}
              className={`flex items-center gap-2 ${
                createKinds.includes(code) ? "" : "opacity-50"
              }`}
            >
              <input
                type="checkbox"
                disabled={!createKinds.includes(code) || saving}
                checked={createChiefKinds.includes(code)}
                onChange={() =>
                  setCreateChiefKinds((prev) =>
                    toggleChief(prev, code, createKinds),
                  )
                }
              />
              {kindLabel(code)}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className="btn-primary w-fit"
          disabled={saving || !email.trim() || !displayName.trim()}
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
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600">{t("arbitersPage.name")}</span>
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
                      {t("arbitersPage.linkedPlayer", { name: row.playerName })}
                    </p>
                  ) : null}
                  {row.chiefKinds.length > 0 ? (
                    <p className="text-sm text-zinc-600">
                      {t("arbitersPage.chiefBadge", {
                        kinds: row.chiefKinds.map(kindLabel).join(", "),
                      })}
                    </p>
                  ) : null}
                </div>
                <fieldset className="flex flex-wrap gap-4 text-sm">
                  <legend className="mb-1 w-full text-zinc-600">
                    {t("arbitersPage.scopes")}
                  </legend>
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
                <fieldset className="flex flex-wrap gap-4 text-sm">
                  <legend className="mb-1 w-full text-zinc-600">
                    {t("arbitersPage.chiefScopes")}
                  </legend>
                  {KIND_OPTIONS.map((code) => {
                    const editable =
                      managedKinds.includes(code) && row.kinds.includes(code);
                    return (
                      <label
                        key={`chief-${row.userId}-${code}`}
                        className={`flex items-center gap-2 ${
                          editable ? "" : "opacity-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!editable || saving}
                          checked={row.chiefKinds.includes(code)}
                          onChange={() =>
                            updateLocal(row.userId, {
                              chiefKinds: toggleChief(
                                row.chiefKinds,
                                code,
                                row.kinds,
                              ),
                            })
                          }
                        />
                        {kindLabel(code)}
                      </label>
                    );
                  })}
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
