"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { sortDivisionsByCanonicalName } from "@/lib/competition/sort-divisions";
import { translateLeagueName } from "@/lib/i18n/labels";

type DivisionLevel = { id: string; code: string; name: string };
type Group = { id: string; name: string };
type Division = { id: string; name: string; league_id: string; groups: Group[] };
type League = {
  id: string;
  name: string;
  divisions: Division[];
};

type Props = {
  leagues: League[];
  divisionLevels: DivisionLevel[];
  readOnly?: boolean;
  onChanged: () => void;
};

export function RegionalStructureSetup({
  leagues,
  divisionLevels,
  readOnly = false,
  onChanged,
}: Props) {
  const t = useTranslations("admin.regionalStructure");
  const tCommon = useTranslations("common");
  const tRegions = useTranslations("regions");

  const [newDivisionName, setNewDivisionName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [addingDivision, setAddingDivision] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [addGroupDivisionId, setAddGroupDivisionId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [removingGroupId, setRemovingGroupId] = useState<string | null>(null);

  const league = leagues[0] ?? null;

  const divisionIds = league
    ? sortDivisionsByCanonicalName(league.divisions).map((d) => d.id)
    : [];

  useEffect(() => {
    if (divisionIds.length > 0 && !addGroupDivisionId) {
      setAddGroupDivisionId(divisionIds[0]);
    }
  }, [divisionIds, addGroupDivisionId]);

  async function createDivision() {
    if (!league || !newDivisionName.trim()) return;
    const levelId = divisionLevels[0]?.id;
    if (!levelId) return;
    setMessage(null);
    const res = await fetch("/api/admin/competition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "division",
        league_id: league.id,
        division_level_id: levelId,
        name: newDivisionName.trim(),
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setMessage(body.error ?? t("actionFailed"));
      return;
    }
    setNewDivisionName("");
    setAddingDivision(false);
    onChanged();
  }

  async function createGroup(divisionId: string) {
    if (!newGroupName.trim()) return;
    setMessage(null);
    const res = await fetch("/api/admin/competition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "group",
        division_id: divisionId,
        name: newGroupName.trim(),
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setMessage(body.error ?? t("actionFailed"));
      return;
    }
    setNewGroupName("");
    setAddingGroup(false);
    onChanged();
  }

  async function removeGroup(groupId: string, groupName: string) {
    if (!confirm(t("confirmRemoveGroup", { name: groupName }))) {
      return;
    }
    setMessage(null);
    setRemovingGroupId(groupId);
    const res = await fetch("/api/admin/competition", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "group", id: groupId }),
    });
    setRemovingGroupId(null);
    if (!res.ok) {
      const body = await res.json();
      setMessage(body.error ?? t("actionFailed"));
      return;
    }
    onChanged();
  }

  if (!league) {
    return (
      <section className="card">
        <p className="text-sm text-amber-800">{t("noLeagueYet")}</p>
      </section>
    );
  }

  const groupCount = league.divisions.reduce(
    (sum, d) => sum + d.groups.length,
    0,
  );

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">
            {translateLeagueName(league.name, tRegions)}
          </h3>
          <span className="text-sm text-zinc-500">
            {t("summary", {
              divisions: league.divisions.length,
              groups: groupCount,
            })}
          </span>
        </div>

        {league.divisions.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">{t("noDivisions")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3 text-sm text-zinc-800">
            {sortDivisionsByCanonicalName(league.divisions).map((division) => (
              <li key={division.id}>
                <span className="font-medium">{division.name}</span>
                {division.groups.length > 0 ? (
                  <ul className="mt-1 flex flex-col gap-1 pl-3">
                    {division.groups.map((group) => (
                      <li
                        key={group.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="text-zinc-700">{group.name}</span>
                        {!readOnly && (
                          <button
                            type="button"
                            className="text-xs font-medium text-red-700 underline hover:text-red-900 disabled:opacity-50"
                            disabled={removingGroupId === group.id}
                            onClick={() =>
                              void removeGroup(group.id, group.name)
                            }
                          >
                            {t("removeGroup")}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-0.5 pl-3 text-xs text-zinc-500">
                    {t("noGroupsInDivision")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {message && (
          <p className="mt-2 text-sm text-red-800" role="status">
            {message}
          </p>
        )}

        {!readOnly && (
          <div className="mt-4 flex flex-col gap-3">
            {addingDivision ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void createDivision();
                }}
              >
                <label className="flex flex-1 flex-col gap-1 text-sm">
                  <span className="font-medium text-zinc-700">
                    {t("divisionName")}
                  </span>
                  <input
                    type="text"
                    value={newDivisionName}
                    onChange={(e) => setNewDivisionName(e.target.value)}
                    className="input"
                    autoFocus
                  />
                </label>
                <button type="submit" className="btn-primary">
                  {t("addDivision")}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setAddingDivision(false)}
                >
                  {tCommon("cancel")}
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="btn-secondary w-fit"
                onClick={() => setAddingDivision(true)}
              >
                {t("addDivision")}
              </button>
            )}

            {divisionIds.length > 0 &&
              (addingGroup ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void createGroup(addGroupDivisionId);
                  }}
                >
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-zinc-700">
                      {t("division")}
                    </span>
                    <select
                      value={addGroupDivisionId}
                      onChange={(e) => setAddGroupDivisionId(e.target.value)}
                      className="input max-w-xs"
                    >
                      {sortDivisionsByCanonicalName(league.divisions).map(
                        (d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-sm">
                    <span className="font-medium text-zinc-700">
                      {t("groupName")}
                    </span>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="input"
                    />
                  </label>
                  <button type="submit" className="btn-primary">
                    {t("addGroup")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setAddingGroup(false)}
                  >
                    {tCommon("cancel")}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn-secondary w-fit"
                  onClick={() => setAddingGroup(true)}
                  disabled={divisionIds.length === 0}
                >
                  {t("addGroup")}
                </button>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
