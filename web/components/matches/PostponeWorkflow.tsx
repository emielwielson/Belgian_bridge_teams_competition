"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MatchPostponementState } from "@/lib/competition/postponement";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { Locale } from "@/i18n/config";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";
import {
  formatBrussels,
  parseBrusselsToUtc,
  toDatetimeLocalValue,
} from "@/lib/time/brussels";

type Props = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
};

export function PostponeWorkflow({
  matchId,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
}: Props) {
  const t = useTranslations("match.reschedule");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const intlLocale = toIntlLocale(locale);
  const translateApiError = useTranslateApiError();
  const [state, setState] = useState<MatchPostponementState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposedLocal, setProposedLocal] = useState("");
  const [proposingTeamId, setProposingTeamId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/matches/${matchId}/postpone`);
    if (res.status === 403) {
      setState(null);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ? translateApiError(body.error) : t("loadFailed"));
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { state: MatchPostponementState };
    setState(body.state);
    if (body.state.captain_teams.length === 1) {
      setProposingTeamId(body.state.captain_teams[0]);
    }
    setProposedLocal(toDatetimeLocalValue(body.state.datetime));
    setLoading(false);
  }, [matchId, t, translateApiError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    if (!proposingTeamId || !proposedLocal) {
      setError(t("chooseTeamAndDate"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/matches/${matchId}/postpone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proposed_datetime: parseBrusselsToUtc(proposedLocal),
        proposing_team_id: proposingTeamId,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ? translateApiError(body.error) : t("proposeFailed"));
      return;
    }
    const body = (await res.json()) as { state: MatchPostponementState };
    setState(body.state);
    setMessage(t("proposedSuccess"));
  }

  async function handleRespond(
    action: "approve" | "reject" | "cancel",
  ) {
    if (!state?.pending) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/matches/${matchId}/postpone`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: state.pending.id,
        action,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setError(
        body.error
          ? translateApiError(body.error)
          : t("respondFailed", { action: tCommon(action) }),
      );
      return;
    }
    const body = (await res.json()) as { state: MatchPostponementState };
    setState(body.state);
    if (action === "approve") {
      setMessage(t("approved"));
    } else if (action === "reject") {
      setMessage(t("rejected"));
    } else {
      setMessage(t("cancelled"));
    }
  }

  if (loading) {
    return (
      <section className="card">
        <p className="text-sm text-zinc-500">{t("loading")}</p>
      </section>
    );
  }

  if (!state) {
    return null;
  }

  const played = state.played_at != null;
  const showSection =
    state.can_propose ||
    state.can_approve ||
    state.can_reject ||
    state.can_cancel ||
    state.pending != null;

  if (!showSection) {
    return null;
  }

  const teamLabel = (teamId: string) =>
    teamId === homeTeamId ? homeTeamName : awayTeamName;

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}

      {played ? (
        <p className="text-sm text-zinc-500">{t("playedNoLonger")}</p>
      ) : state.pending ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
          <p className="font-medium text-amber-900">{t("pendingTitle")}</p>
          <p className="mt-1 text-amber-800">
            {t("pendingBody", {
              proposingTeam: teamLabel(state.pending.proposing_team_id),
              proposedDatetime: formatBrussels(
                state.pending.proposed_datetime,
                intlLocale,
              ),
              currentDatetime: formatBrussels(state.datetime, intlLocale),
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.can_approve ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRespond("approve")}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                {tCommon("approve")}
              </button>
            ) : null}
            {state.can_reject ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRespond("reject")}
                className="btn-secondary px-3 py-1.5 text-sm"
              >
                {tCommon("reject")}
              </button>
            ) : null}
            {state.can_cancel ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRespond("cancel")}
                className="text-sm text-zinc-600 hover:underline"
              >
                {t("cancelRequest")}
              </button>
            ) : null}
          </div>
          </div>
      ) : state.can_propose ? (
        <form onSubmit={handlePropose} className="flex flex-col gap-3">
          {state.captain_teams.length > 1 ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600">{t("proposingAs")}</span>
              <select
                value={proposingTeamId}
                onChange={(e) => setProposingTeamId(e.target.value)}
                className="input"
                required
              >
                <option value="">{t("selectTeam")}</option>
                {state.captain_teams.map((id) => (
                  <option key={id} value={id}>
                    {teamLabel(id)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">{t("newDateTime")}</span>
            <input
              type="datetime-local"
              value={proposedLocal}
              onChange={(e) => setProposedLocal(e.target.value)}
              className="input"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy || !proposingTeamId}
            className="btn-primary w-fit disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:opacity-100 hover:disabled:bg-zinc-400"
          >
            {busy ? t("sending") : t("proposeNewDate")}
          </button>
        </form>
      ) : null}
    </section>
  );
}
