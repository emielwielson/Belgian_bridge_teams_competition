"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  ArbiterResolveScoreFields,
  emptyScoreCorrection,
  isScoreCorrectionComplete,
  scoreCorrectionToPayload,
  type ScoreCorrectionValue,
} from "@/components/arbiter/ArbiterResolveScoreFields";
import {
  DisciplinePenaltyFields,
  emptyPenaltyFields,
  isPenaltyFieldsComplete,
  penaltyFieldsToPayload,
  type PenaltyFieldsValue,
  type TeamOption,
} from "@/components/discipline/DisciplinePenaltyFields";
import {
  DisciplineWarningFields,
  emptyWarningFields,
  isWarningFieldsComplete,
  warningFieldsToPayload,
  type WarningFieldsValue,
} from "@/components/discipline/DisciplineWarningFields";
import { FilePickerField } from "@/components/files/FilePickerField";
import type { InboxMatchContext } from "@/lib/competition/arbiter-request";
import type { Locale } from "@/i18n/config";
import { toIntlLocale } from "@/i18n/intl-locale";
import { formatBrussels } from "@/lib/time/brussels";

type InboxRequest = {
  id: string;
  match_id: string;
  description: string | null;
  status: string;
  created_at: string;
  image_signed_url: string | null;
  match: InboxMatchContext | null;
};

type ResolveDraft = {
  file: File | null;
  uploadedPath: string | null;
  uploading: boolean;
  fileInputKey: number;
  adjustScore: boolean;
  score: ScoreCorrectionValue | null;
  addPenalty: boolean;
  penalty: PenaltyFieldsValue | null;
  addWarning: boolean;
  warning: WarningFieldsValue | null;
};

function emptyDraft(match: InboxMatchContext | null): ResolveDraft {
  const homeTeamId = match?.home_team?.id ?? "";
  return {
    file: null,
    uploadedPath: null,
    uploading: false,
    fileInputKey: 0,
    adjustScore: false,
    score: match
      ? emptyScoreCorrection(
          match.imps_home,
          match.imps_away,
          match.mis_seating,
          match.selected_board_count,
        )
      : null,
    addPenalty: false,
    penalty: homeTeamId ? emptyPenaltyFields(homeTeamId) : null,
    addWarning: false,
    warning: homeTeamId ? emptyWarningFields(homeTeamId) : null,
  };
}

function teamOptions(match: InboxMatchContext): {
  homeTeam: TeamOption;
  awayTeam: TeamOption;
} | null {
  if (!match.home_team || !match.away_team) return null;
  return {
    homeTeam: { id: match.home_team.id, name: match.home_team.name },
    awayTeam: { id: match.away_team.id, name: match.away_team.name },
  };
}

export function ArbiterInbox() {
  const t = useTranslations("arbiter");
  const locale = useLocale() as Locale;
  const intlLocale = toIntlLocale(locale);
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveDrafts, setResolveDrafts] = useState<
    Record<string, ResolveDraft>
  >({});
  const [rulingLinks, setRulingLinks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/arbiter/requests?status=open");
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? t("loadFailed"));
      setLoading(false);
      return;
    }
    setRequests(body.requests ?? []);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function getDraft(request: InboxRequest): ResolveDraft {
    return resolveDrafts[request.id] ?? emptyDraft(request.match);
  }

  function updateDraft(request: InboxRequest, patch: Partial<ResolveDraft>) {
    setResolveDrafts((prev) => ({
      ...prev,
      [request.id]: { ...getDraft(request), ...patch },
    }));
  }

  async function handleRulingFileChange(
    request: InboxRequest,
    next: File | null,
  ) {
    const requestId = request.id;
    const draft = getDraft(request);

    updateDraft(request, {
      file: next,
      uploadedPath: null,
      uploading: Boolean(next),
    });

    if (!next) return;

    try {
      const uploadData = new FormData();
      uploadData.append("file", next);
      uploadData.append("purpose", "ruling");
      uploadData.append("matchId", request.match_id);
      const uploadRes = await fetch("/api/files/upload", {
        method: "POST",
        body: uploadData,
      });
      const uploadBody = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadBody.error ?? t("uploadRulingFailed"));
      }
      updateDraft(request, {
        file: next,
        uploadedPath: uploadBody.path as string,
        uploading: false,
      });
    } catch (e) {
      updateDraft(request, {
        file: null,
        uploadedPath: null,
        uploading: false,
        fileInputKey: draft.fileInputKey + 1,
      });
      setMessage(e instanceof Error ? e.message : t("uploadRulingFailed"));
    }
  }

  function validateDraft(request: InboxRequest, draft: ResolveDraft): string | null {
    const match = request.match;
    if (!match) return t("resolveFailed");

    if (draft.adjustScore && draft.score) {
      if (!match.played_at) return t("scoreRequiresPlayed");
      if (
        !isScoreCorrectionComplete(draft.score, match.allows_board_choice)
      ) {
        return t("scoreFieldsIncomplete");
      }
    }

    if (draft.addPenalty && draft.penalty && !isPenaltyFieldsComplete(draft.penalty)) {
      return t("penaltyFieldsIncomplete");
    }

    if (draft.addWarning && draft.warning && !isWarningFieldsComplete(draft.warning)) {
      return t("warningFieldsIncomplete");
    }

    return null;
  }

  async function resolve(request: InboxRequest) {
    const draft = getDraft(request);
    if (!draft.uploadedPath) {
      setMessage(t("uploadRulingFirst"));
      return;
    }

    const validationError = validateDraft(request, draft);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setBusyId(request.id);
    setMessage(null);

    try {
      const match = request.match;
      const payload: Record<string, unknown> = {
        file_path: draft.uploadedPath,
      };

      if (draft.adjustScore && draft.score && match) {
        payload.score_change = scoreCorrectionToPayload(
          draft.score,
          match.allows_board_choice,
        );
      }

      if (draft.addPenalty && draft.penalty) {
        payload.penalties = [penaltyFieldsToPayload(draft.penalty)];
      }

      if (draft.addWarning && draft.warning) {
        payload.warnings = [warningFieldsToPayload(draft.warning)];
      }

      const res = await fetch(
        `/api/arbiter/requests/${request.id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? t("resolveFailed"));
      }

      if (body.rulingSignedUrl) {
        setRulingLinks((prev) => ({
          ...prev,
          [request.id]: body.rulingSignedUrl,
        }));
      }

      setResolveDrafts((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      await load();
      setMessage(t("resolvedSuccess"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("resolveFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {message ? <p className="mb-4 text-sm text-zinc-700">{message}</p> : null}
      {loading ? (
        <p className="text-sm text-zinc-600">{t("loading")}</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-zinc-600">{t("none")}</p>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {requests.map((r) => {
            const m = r.match;
            const label = m
              ? t("matchLine", {
                  round: m.round,
                  homeTeam: m.home_team?.name ?? "?",
                  awayTeam: m.away_team?.name ?? "?",
                })
              : t("matchFallback");
            const draft = getDraft(r);
            const rulingLink = rulingLinks[r.id];
            const teams = m ? teamOptions(m) : null;
            const canResolve =
              Boolean(draft.uploadedPath) &&
              !draft.uploading &&
              busyId !== r.id;
            return (
              <li key={r.id} className="py-4">
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="font-medium text-zinc-900">{label}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("submitted", {
                        datetime: formatBrussels(r.created_at, intlLocale),
                      })}
                      {m?.datetime
                        ? t("matchDatetime", {
                            datetime: formatBrussels(m.datetime, intlLocale),
                          })
                        : ""}
                    </p>
                    {r.image_signed_url ? (
                      <p className="mt-2">
                        <a
                          href={r.image_signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-emerald-800 underline"
                        >
                          {t("viewAttachment")}
                        </a>
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-600">
                        {t("noAttachment")}
                      </p>
                    )}
                    <p className="mt-2">
                      <Link
                        href={`/matches/${r.match_id}`}
                        className="text-sm text-zinc-600 underline hover:text-zinc-900"
                      >
                        {t("openMatch")}
                      </Link>
                    </p>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-sm font-medium text-zinc-900">
                      {t("resolveTitle")}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">{t("resolveHint")}</p>
                    <div className="mt-3">
                      <FilePickerField
                        key={draft.fileInputKey}
                        id={`ruling-file-${r.id}`}
                        file={draft.file}
                        onFileChange={(next) =>
                          void handleRulingFileChange(r, next)
                        }
                        hint={t("rulingFileHint")}
                        disabled={busyId === r.id || draft.uploading}
                      />
                      {draft.uploading ? (
                        <p className="mt-1 text-xs text-zinc-600">
                          {t("uploadingRuling")}
                        </p>
                      ) : draft.uploadedPath ? (
                        <p className="mt-1 text-xs text-emerald-800">
                          {t("rulingUploaded")}
                        </p>
                      ) : null}
                    </div>

                    {m?.played_at && draft.score && teams ? (
                      <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                          <input
                            type="checkbox"
                            checked={draft.adjustScore}
                            onChange={(e) =>
                              updateDraft(r, { adjustScore: e.target.checked })
                            }
                            disabled={busyId === r.id}
                          />
                          {t("adjustScore")}
                        </label>
                        {draft.adjustScore ? (
                          <div className="mt-3">
                            <ArbiterResolveScoreFields
                              scheduledBoardCount={m.board_count}
                              allowsBoardChoice={m.allows_board_choice}
                              initialVpHome={m.vp_home}
                              initialVpAway={m.vp_away}
                              value={draft.score}
                              onChange={(score) => updateDraft(r, { score })}
                              disabled={busyId === r.id}
                              idPrefix={`score-${r.id}`}
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {teams ? (
                      <>
                        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3">
                          <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                            <input
                              type="checkbox"
                              checked={draft.addPenalty}
                              onChange={(e) =>
                                updateDraft(r, { addPenalty: e.target.checked })
                              }
                              disabled={busyId === r.id}
                            />
                            {t("addPenalty")}
                          </label>
                          {draft.addPenalty && draft.penalty ? (
                            <div className="mt-3">
                              <DisciplinePenaltyFields
                                homeTeam={teams.homeTeam}
                                awayTeam={teams.awayTeam}
                                value={draft.penalty}
                                onChange={(penalty) =>
                                  updateDraft(r, { penalty })
                                }
                                disabled={busyId === r.id}
                                idPrefix={`penalty-${r.id}`}
                              />
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3">
                          <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                            <input
                              type="checkbox"
                              checked={draft.addWarning}
                              onChange={(e) =>
                                updateDraft(r, { addWarning: e.target.checked })
                              }
                              disabled={busyId === r.id}
                            />
                            {t("addWarning")}
                          </label>
                          {draft.addWarning && draft.warning ? (
                            <div className="mt-3">
                              <DisciplineWarningFields
                                homeTeam={teams.homeTeam}
                                awayTeam={teams.awayTeam}
                                value={draft.warning}
                                onChange={(warning) =>
                                  updateDraft(r, { warning })
                                }
                                disabled={busyId === r.id}
                                idPrefix={`warning-${r.id}`}
                              />
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : null}

                    <button
                      type="button"
                      disabled={!canResolve}
                      onClick={() => resolve(r)}
                      className="btn-primary mt-3 text-sm disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:opacity-100 hover:disabled:bg-zinc-400"
                    >
                      {busyId === r.id ? t("resolving") : t("resolveButton")}
                    </button>
                    {rulingLink ? (
                      <p className="mt-2 text-sm">
                        <a
                          href={rulingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-emerald-800 underline"
                        >
                          {t("viewPublishedRuling")}
                        </a>
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
