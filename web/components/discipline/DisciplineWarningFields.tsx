"use client";

import { useTranslations } from "next-intl";
import type { TeamOption } from "./DisciplinePenaltyFields";

export type WarningFieldsValue = {
  teamId: string;
  warningDate: string;
  reason: string;
};

type Props = {
  homeTeam: TeamOption;
  awayTeam: TeamOption;
  value: WarningFieldsValue;
  onChange: (value: WarningFieldsValue) => void;
  disabled?: boolean;
  idPrefix?: string;
};

export function DisciplineWarningFields({
  homeTeam,
  awayTeam,
  value,
  onChange,
  disabled = false,
  idPrefix = "warning",
}: Props) {
  const t = useTranslations("arbiter.warning");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-medium text-zinc-600">
        {t("team")}
        <select
          id={`${idPrefix}-team`}
          value={value.teamId}
          onChange={(e) => onChange({ ...value, teamId: e.target.value })}
          disabled={disabled}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
        >
          <option value={homeTeam.id}>{homeTeam.name}</option>
          <option value={awayTeam.id}>{awayTeam.name}</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-zinc-600">
        {t("date")}
        <input
          id={`${idPrefix}-date`}
          type="date"
          value={value.warningDate}
          onChange={(e) => onChange({ ...value, warningDate: e.target.value })}
          disabled={disabled}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
        {t("reason")}
        <textarea
          id={`${idPrefix}-reason`}
          value={value.reason}
          onChange={(e) => onChange({ ...value, reason: e.target.value })}
          rows={3}
          disabled={disabled}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
        />
      </label>
    </div>
  );
}

export function emptyWarningFields(homeTeamId: string): WarningFieldsValue {
  return {
    teamId: homeTeamId,
    warningDate: new Date().toISOString().slice(0, 10),
    reason: "",
  };
}

export function isWarningFieldsComplete(value: WarningFieldsValue): boolean {
  return value.reason.trim() !== "";
}

export function warningFieldsToPayload(value: WarningFieldsValue) {
  return {
    team_id: value.teamId,
    warning_date: value.warningDate,
    reason: value.reason.trim(),
  };
}
