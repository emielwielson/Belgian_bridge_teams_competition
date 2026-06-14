"use client";

import { useTranslations } from "next-intl";

export type TeamOption = {
  id: string;
  name: string;
};

export type PenaltyFieldsValue = {
  teamId: string;
  penaltyDate: string;
  reason: string;
  vpDeduction: string;
};

type Props = {
  homeTeam: TeamOption;
  awayTeam: TeamOption;
  value: PenaltyFieldsValue;
  onChange: (value: PenaltyFieldsValue) => void;
  disabled?: boolean;
  idPrefix?: string;
};

export function DisciplinePenaltyFields({
  homeTeam,
  awayTeam,
  value,
  onChange,
  disabled = false,
  idPrefix = "penalty",
}: Props) {
  const t = useTranslations("match.penalty");

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
          value={value.penaltyDate}
          onChange={(e) => onChange({ ...value, penaltyDate: e.target.value })}
          disabled={disabled}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
        {t("vpDeduction")}
        <input
          id={`${idPrefix}-vp`}
          type="number"
          min={0}
          step={0.1}
          value={value.vpDeduction}
          onChange={(e) => onChange({ ...value, vpDeduction: e.target.value })}
          disabled={disabled}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600 sm:col-span-2">
        {t("motivation")}
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

export function emptyPenaltyFields(homeTeamId: string): PenaltyFieldsValue {
  return {
    teamId: homeTeamId,
    penaltyDate: new Date().toISOString().slice(0, 10),
    reason: "",
    vpDeduction: "0",
  };
}

export function isPenaltyFieldsComplete(value: PenaltyFieldsValue): boolean {
  const vp = Number(value.vpDeduction);
  return (
    value.reason.trim() !== "" &&
    Number.isFinite(vp) &&
    vp >= 0
  );
}

export function penaltyFieldsToPayload(value: PenaltyFieldsValue) {
  return {
    team_id: value.teamId,
    penalty_date: value.penaltyDate,
    reason: value.reason.trim(),
    vp_deduction: Number(value.vpDeduction),
  };
}
