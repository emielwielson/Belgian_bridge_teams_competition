import {
  buildPostponementDecisionEmail,
  buildPostponementProposedEmail,
  loadEmailTemplateContext,
} from "@/lib/i18n/email-templates";
import { createServiceClient } from "@/lib/supabase/server-client";
import {
  captainContactWebhookFields,
  captainEmailsFromContacts,
  loadCaptainContactsForTeams,
  splitRequestingAndReceivingCaptains,
  toCaptainContactFields,
} from "./captain-contacts";
import { sendMakeWebhook } from "./make-webhook";

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

async function loadWorkflowCc(
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
  return {
    captainFields: toCaptainContactFields(requesting, receiving),
    webhookFields: captainContactWebhookFields(requesting, receiving),
  };
}

/** Sends postponement-proposed email via Make.com (CC: both captains). */
export async function sendPostponementProposedEmail(
  ctx: PostponementProposedEmailContext,
  homeTeamId: string,
  awayTeamId: string,
  locale?: string | null,
): Promise<void> {
  const cc = await loadWorkflowCc(homeTeamId, awayTeamId);
  if (cc.length === 0) return;

  const { captainFields, webhookFields } = await loadCaptainContactFields(
    homeTeamId,
    awayTeamId,
    ctx.requestingTeamId,
  );

  const emailContext = await loadEmailTemplateContext(locale);
  const matchUrl = matchPostponementUrl(ctx.matchId);
  const { subject, bodyText, bodyHtml } = buildPostponementProposedEmail(
    { ...ctx, ...captainFields },
    matchUrl,
    emailContext,
  );

  await sendMakeWebhook(
    {
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      cc,
      match_id: ctx.matchId,
      match_url: matchUrl,
      round: ctx.round,
      home_team_name: ctx.homeTeamName,
      away_team_name: ctx.awayTeamName,
      proposing_team_name: ctx.proposingTeamName,
      previous_datetime: ctx.previousDatetime,
      proposed_datetime: ctx.proposedDatetime,
      ...webhookFields,
    },
    { eventType: "postponement_proposed" },
  );
}

/** Sends postponement decision email via Make.com (CC: both captains). */
export async function sendPostponementDecisionEmail(
  ctx: PostponementDecisionEmailContext,
  homeTeamId: string,
  awayTeamId: string,
  locale?: string | null,
): Promise<void> {
  const cc = await loadWorkflowCc(homeTeamId, awayTeamId);
  if (cc.length === 0) return;

  const { captainFields, webhookFields } = await loadCaptainContactFields(
    homeTeamId,
    awayTeamId,
    ctx.requestingTeamId,
  );

  const emailContext = await loadEmailTemplateContext(locale);
  const matchUrl = matchPostponementUrl(ctx.matchId);
  const loginUrl = loginThenMatchUrl(ctx.matchId);
  const { subject, bodyText, bodyHtml } = buildPostponementDecisionEmail(
    { ...ctx, ...captainFields },
    matchUrl,
    loginUrl,
    emailContext,
  );

  const actionLabelByAction: Record<PostponementDecision, string> = {
    approve: emailContext.t("postponementDecision.approved"),
    reject: emailContext.t("postponementDecision.rejected"),
    cancel: emailContext.t("postponementDecision.cancelled"),
  };
  const eventTypeByAction: Record<
    PostponementDecision,
    "postponement_approved" | "postponement_rejected" | "postponement_cancelled"
  > = {
    approve: "postponement_approved",
    reject: "postponement_rejected",
    cancel: "postponement_cancelled",
  };

  await sendMakeWebhook(
    {
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      cc,
      match_id: ctx.matchId,
      match_url: matchUrl,
      login_url: loginUrl,
      round: ctx.round,
      home_team_name: ctx.homeTeamName,
      away_team_name: ctx.awayTeamName,
      proposing_team_name: ctx.proposingTeamName,
      previous_datetime: ctx.previousDatetime,
      proposed_datetime: ctx.proposedDatetime,
      action: actionLabelByAction[ctx.action],
      ...webhookFields,
    },
    { eventType: eventTypeByAction[ctx.action] },
  );
}
