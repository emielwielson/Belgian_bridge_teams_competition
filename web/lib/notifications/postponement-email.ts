import {
  buildPostponementDecisionEmail,
  buildPostponementProposedEmail,
  loadEmailTemplateContext,
} from "@/lib/i18n/email-templates";
import { createServiceClient } from "@/lib/supabase/server-client";
import {
  captainEmailsFromContacts,
  loadCaptainContactsForTeams,
  splitRequestingAndReceivingCaptains,
  toCaptainContactFields,
} from "./captain-contacts";
import { loadMatchCompetitionKindCode } from "./match-competition-kind";
import { sendResendEmail } from "./resend-email";

export type PostponementProposedEmailContext = {
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  previousDatetime: string;
  proposedDatetime: string;
  proposingTeamName: string;
  requestingTeamId: string;
};

export type PostponementDecision = "approve" | "reject" | "cancel";

export type PostponementDecisionEmailContext = {
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  previousDatetime: string;
  proposedDatetime: string;
  proposingTeamName: string;
  requestingTeamId: string;
  action: PostponementDecision;
};

export function getAppBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL;
  if (!fromEnv) return "http://localhost:3000";
  if (fromEnv.startsWith("http")) return fromEnv.replace(/\/$/, "");
  return `https://${fromEnv.replace(/\/$/, "")}`;
}

export function matchPostponementUrl(matchId: string): string {
  const path = `/matches/${matchId}`;
  return `${getAppBaseUrl()}${path}`;
}

export function loginThenMatchUrl(matchId: string): string {
  const next = encodeURIComponent(`/matches/${matchId}`);
  return `${getAppBaseUrl()}/login?next=${next}`;
}

function uniqueEmails(addresses: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of addresses) {
    const email = raw.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(raw.trim());
  }
  return out;
}

async function loadWorkflowRecipients(
  homeTeamId: string,
  awayTeamId: string,
): Promise<string[]> {
  const supabase = createServiceClient();
  const contacts = await loadCaptainContactsForTeams(supabase, [
    homeTeamId,
    awayTeamId,
  ]);
  return uniqueEmails(captainEmailsFromContacts(contacts));
}

async function loadCaptainContactFields(
  homeTeamId: string,
  awayTeamId: string,
  requestingTeamId: string,
) {
  const supabase = createServiceClient();
  const contacts = await loadCaptainContactsForTeams(supabase, [
    homeTeamId,
    awayTeamId,
  ]);
  const { requesting, receiving } = splitRequestingAndReceivingCaptains(
    contacts,
    homeTeamId,
    awayTeamId,
    requestingTeamId,
  );
  return toCaptainContactFields(requesting, receiving);
}

/** Sends postponement-proposed email via Resend (both captains). */
export async function sendPostponementProposedEmail(
  ctx: PostponementProposedEmailContext,
  homeTeamId: string,
  awayTeamId: string,
  locale?: string | null,
): Promise<void> {
  const to = await loadWorkflowRecipients(homeTeamId, awayTeamId);
  if (to.length === 0) return;

  const [captainFields, emailContext, competitionKind] = await Promise.all([
    loadCaptainContactFields(homeTeamId, awayTeamId, ctx.requestingTeamId),
    loadEmailTemplateContext(locale),
    loadMatchCompetitionKindCode(ctx.matchId),
  ]);
  const matchUrl = matchPostponementUrl(ctx.matchId);
  const { subject, bodyText, bodyHtml } = buildPostponementProposedEmail(
    { ...ctx, ...captainFields },
    matchUrl,
    emailContext,
  );

  await sendResendEmail({
    to,
    subject,
    html: bodyHtml,
    text: bodyText,
    competitionKind: competitionKind ?? undefined,
    logLabel: "postponement_proposed",
  });
}

/** Sends postponement decision email via Resend (both captains). */
export async function sendPostponementDecisionEmail(
  ctx: PostponementDecisionEmailContext,
  homeTeamId: string,
  awayTeamId: string,
  locale?: string | null,
): Promise<void> {
  const to = await loadWorkflowRecipients(homeTeamId, awayTeamId);
  if (to.length === 0) return;

  const [captainFields, emailContext, competitionKind] = await Promise.all([
    loadCaptainContactFields(homeTeamId, awayTeamId, ctx.requestingTeamId),
    loadEmailTemplateContext(locale),
    loadMatchCompetitionKindCode(ctx.matchId),
  ]);
  const matchUrl = matchPostponementUrl(ctx.matchId);
  const loginUrl = loginThenMatchUrl(ctx.matchId);
  const { subject, bodyText, bodyHtml } = buildPostponementDecisionEmail(
    { ...ctx, ...captainFields },
    matchUrl,
    loginUrl,
    emailContext,
  );

  const logLabelByAction: Record<PostponementDecision, string> = {
    approve: "postponement_approved",
    reject: "postponement_rejected",
    cancel: "postponement_cancelled",
  };

  await sendResendEmail({
    to,
    subject,
    html: bodyHtml,
    text: bodyText,
    competitionKind: competitionKind ?? undefined,
    logLabel: logLabelByAction[ctx.action],
  });
}
