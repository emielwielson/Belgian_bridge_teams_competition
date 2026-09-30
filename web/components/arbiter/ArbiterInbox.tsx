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
import { FilePickerField, FILE_PICKER_ACCEPT } from "@/components/files/FilePickerField";
import type { InboxMatchContext } from "@/lib/competition/arbiter-request";
import type { CompetitionKindCode } from "@/lib/auth/competition-scope";
import type { Locale } from "@/i18n/config";
import { toIntlLocale } from "@/i18n/intl-locale";
import { formatBrussels } from "@/lib/time/brussels";

type InboxAttachment = {
  storage_path: string;
  signed_url: string | null;
  sort_order: number;
};

type AssignableArbiter = {
  userId: string;
  email: string | null;
};

type InboxRequest = {
  id: string;
  match_id: string;
  description: string | null;
  status: string;
  created_at: string;
  attachments: InboxAttachment[];
  assigned_arbiter_id: string | null;
  assigned_arbiter_email: string | null;
  ruling_signed_url?: string | null;
  match: InboxMatchContext | null;
};

type StatusFilter = "open" | "resolved" | "cancelled" | "all";

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

type AttachmentKind = "pdf" | "image" | "file";

function attachmentKind(storagePath: string): AttachmentKind {
  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(ext)) {
    return "image";
  }
  return "file";
}

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

export function ArbiterInbox({
  kind,
  canCancelRequests = false,
}: {
  kind: CompetitionKindCode;
  canCancelRequests?: boolean;
}) {
  const t = useTranslations("arbiter");
  const locale = useLocale() as Locale;
  const intlLocale = toIntlLocale(locale);
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [canAssign, setCanAssign] = useState(false);
  const [assignableArbiters, setAssignableArbiters] = useState<
    AssignableArbiter[]
  >([]);
  const [assignDrafts, setAssignDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolveDrafts, setResolveDrafts] = useState<
    Record<string, ResolveDraft>
  >({});
  const [rulingLinks, setRulingLinks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const res = await fetch(
      `/api/arbiter/requests?status=${encodeURIComponent(statusFilter)}&kind=${encodeURIComponent(kind)}`,
    );
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? t("loadFailed"));
      setLoading(false);
      return;
    }
    setCanAssign(Boolean(body.canAssign));
    setAssignableArbiters(
      Array.isArray(body.assignableArbiters) ? body.assignableArbiters : [],
    );
    const nextRequests = (body.requests ?? []).map((r: InboxRequest) => ({
      ...r,
      attachments: Array.isArray(r.attachments) ? r.attachments : [],
      assigned_arbiter_id: r.assigned_arbiter_id ?? null,
      assigned_arbiter_email: r.assigned_arbiter_email ?? null,
      ruling_signed_url: r.ruling_signed_url ?? null,
    }));
    setRequests(nextRequests);
    setRulingLinks((prev) => {
      const next = { ...prev };
      for (const r of nextRequests) {
        if (r.ruling_signed_url) {
          next[r.id] = r.ruling_signed_url;
        }
      }
      return next;
    });
    setLoading(false);
  }, [kind, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setExpandedId(null);
  }, [kind, statusFilter]);

  function getDraft(request: InboxRequest): ResolveDraft {
    return resolveDrafts[request.id] ?? emptyDraft(request.match);
  }

  function updateDraft(request: InboxRequest, patch: Partial<ResolveDraft>) {
    setResolveDrafts((prev) => ({
      ...prev,
      [request.id]: { ...getDraft(request), ...patch },
    }));
  }

  function toggleExpanded(requestId: string) {
    setExpandedId((prev) => (prev === requestId ? null : requestId));
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

  async function cancel(request: InboxRequest) {
    if (!window.confirm(t("cancelConfirm"))) return;

    setBusyId(request.id);
    setMessage(null);

    try {
      const res = await fetch(`/api/arbiter/requests/${request.id}/cancel`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? t("cancelFailed"));
      }

      setResolveDrafts((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      await load();
      setMessage(t("cancelledSuccess"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("cancelFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function assign(request: InboxRequest) {
    const arbiterUserId =
      assignDrafts[request.id] || request.assigned_arbiter_id || "";
    if (!arbiterUserId) {
      setMessage(t("assignFailed"));
      return;
    }

    setBusyId(request.id);
    setMessage(null);

    try {
      const res = await fetch(`/api/arbiter/requests/${request.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arbiter_user_id: arbiterUserId }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? t("assignFailed"));
      }
      await load();
      setMessage(t("assignedSuccess"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("assignFailed"));
    } finally {
      setBusyId(null);
    }
  }

  function attachmentKindLabel(fileKind: AttachmentKind): string {
    if (fileKind === "pdf") return t("attachmentPdf");
    if (fileKind === "image") return t("attachmentImage");
    return t("attachmentFile");
  }

  function statusLabel(status: string): string {
    if (status === "resolved") return t("statusResolved");
    if (status === "cancelled") return t("statusCancelled");
    return t("statusOpen");
  }

  function statusClass(status: string): string {
    if (status === "resolved") return "font-medium text-emerald-800";
    if (status === "cancelled") return "font-medium text-zinc-600";
    return "font-medium text-amber-700";
  }

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: "open", label: t("filterOpen") },
    { value: "resolved", label: t("filterResolved") },
    { value: "cancelled", label: t("filterCancelled") },
    { value: "all", label: t("filterAll") },
  ];

  return (
    <div>
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label={t("filterLabel")}
      >
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={
              statusFilter === opt.value
                ? "rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            }
            aria-pressed={statusFilter === opt.value}
            onClick={() => setStatusFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {message ? <p className="mb-4 text-sm text-zinc-700">{message}</p> : null}
      {loading ? (
        <p className="text-sm text-zinc-600">{t("loading")}</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-zinc-600">{t("none")}</p>
      ) : (
        <ul className="space-y-3">
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
            const rulingLink = rulingLinks[r.id] ?? r.ruling_signed_url;
            const teams = m ? teamOptions(m) : null;
            const isOpen = r.status === "open";
            const canResolve =
              isOpen &&
              Boolean(draft.uploadedPath) &&
              !draft.uploading &&
              busyId !== r.id;
            const isExpanded = expandedId === r.id;
            const signedAttachments = r.attachments.filter(
              (att) => att.signed_url,
            );
            const panelId = `arbiter-request-${r.id}`;

            return (
              <li
                key={r.id}
                className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-zinc-50"
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => toggleExpanded(r.id)}
                >
                  <span
                    className={`mt-1 shrink-0 text-zinc-500 transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                    aria-hidden
                  >
                    ▸
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-zinc-900">
                      {label}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                      <span className={statusClass(r.status)}>
                        {statusLabel(r.status)}
                      </span>
                      <span>
                        {t("submitted", {
                          datetime: formatBrussels(r.created_at, intlLocale),
                        })}
                      </span>
                      {m?.datetime ? (
                        <span>
                          {t("matchDatetime", {
                            datetime: formatBrussels(m.datetime, intlLocale),
                          })}
                        </span>
                      ) : null}
                      {r.attachments.length > 0 ? (
                        <span>
                          {t("attachmentCount", {
                            count: r.attachments.length,
                          })}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm text-zinc-700">
                      {r.assigned_arbiter_email
                        ? t("assignedTo", { email: r.assigned_arbiter_email })
                        : t("unassigned")}
                    </span>
                  </span>
                  <span className="sr-only">
                    {isExpanded ? t("collapseRequest") : t("expandRequest")}
                  </span>
                </button>

                {isExpanded ? (
                  <div
                    id={panelId}
                    className="flex flex-col gap-4 border-t border-zinc-200 px-4 pb-4 pt-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {t("descriptionLabel")}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">
                        {r.description?.trim()
                          ? r.description
                          : t("noDescription")}
                      </p>
                    </div>

                    {signedAttachments.length > 0 ? (
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {signedAttachments.map((att, index) => {
                          const fileKind = attachmentKind(att.storage_path);
                          return (
                            <li
                              key={`${att.storage_path}-${att.sort_order}`}
                              className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                            >
                              {fileKind === "image" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={att.signed_url!}
                                  alt={t("viewAttachmentN", { n: index + 1 })}
                                  className="h-36 w-full rounded object-contain bg-white"
                                />
                              ) : (
                                <div className="flex h-20 items-center justify-center rounded bg-white text-sm font-medium text-zinc-600">
                                  {attachmentKindLabel(fileKind)}
                                </div>
                              )}
                              <a
                                href={att.signed_url!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary w-fit px-3 py-1.5 text-sm"
                              >
                                {t("openAttachment")}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-zinc-600">
                        {t("noAttachment")}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/matches/${r.match_id}`}
                        className="btn-secondary inline-flex px-3 py-1.5 text-sm"
                      >
                        {t("openMatch")}
                      </Link>
                      {rulingLink ? (
                        <a
                          href={rulingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary inline-flex px-3 py-1.5 text-sm"
                        >
                          {t("viewPublishedRuling")}
                        </a>
                      ) : null}
                    </div>

                    {isOpen && canAssign ? (
                      <div className="rounded-lg border border-zinc-200 bg-white p-3">
                        <p className="text-sm font-medium text-zinc-900">
                          {t("assignTitle")}
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">
                          {t("assignHint")}
                        </p>
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
                            <span className="text-zinc-600">
                              {t("assignSelect")}
                            </span>
                            <select
                              className="rounded border border-zinc-300 px-3 py-2"
                              value={
                                assignDrafts[r.id] ??
                                r.assigned_arbiter_id ??
                                ""
                              }
                              onChange={(e) =>
                                setAssignDrafts((prev) => ({
                                  ...prev,
                                  [r.id]: e.target.value,
                                }))
                              }
                              disabled={busyId === r.id}
                            >
                              <option value="">{t("assignSelect")}</option>
                              {assignableArbiters.map((arb) => (
                                <option key={arb.userId} value={arb.userId}>
                                  {arb.email ?? arb.userId}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="btn-secondary text-sm"
                            disabled={
                              busyId === r.id ||
                              !(
                                assignDrafts[r.id] ||
                                r.assigned_arbiter_id
                              )
                            }
                            onClick={() => void assign(r)}
                          >
                            {busyId === r.id
                              ? t("assigning")
                              : t("assignButton")}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {isOpen ? (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-sm font-medium text-zinc-900">
                        {t("resolveTitle")}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {t("resolveHint")}
                      </p>
                      <div className="mt-3">
                        <FilePickerField
                          key={draft.fileInputKey}
                          id={`ruling-file-${r.id}`}
                          file={draft.file}
                          onFileChange={(next) =>
                            void handleRulingFileChange(r, next)
                          }
                          hint={t("rulingFileHint")}
                          accept={FILE_PICKER_ACCEPT}
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
                                updateDraft(r, {
                                  adjustScore: e.target.checked,
                                })
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
                                onChange={(score) =>
                                  updateDraft(r, { score })
                                }
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
                                  updateDraft(r, {
                                    addPenalty: e.target.checked,
                                  })
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
                                  updateDraft(r, {
                                    addWarning: e.target.checked,
                                  })
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
                        {busyId === r.id
                          ? t("resolving")
                          : t("resolveButton")}
                      </button>
                      {canCancelRequests ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void cancel(r)}
                          className="mt-3 ml-3 text-sm text-zinc-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {t("cancelButton")}
                        </button>
                      ) : null}
                    </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
