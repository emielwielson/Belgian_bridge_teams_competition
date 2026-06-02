import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildPostponementDecisionEmail,
  buildPostponementProposedEmail,
  loadEmailTemplateContext,
} from "@/lib/i18n/email-templates";
import { createServiceClient } from "@/lib/supabase/server-client";
import { sendMakeWebhook } from "./make-webhook";

export type PostponementProposedEmailContext = {
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  previousDatetime: string;
  proposedDatetime: string;
  proposingTeamName: string;
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
  action: PostponementDecision;
};

function unwrapOne<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

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

async function loadCaptainEmailsForTeams(
  supabase: SupabaseClient,
  teamIds: string[],
): Promise<string[]> {
  if (teamIds.length === 0) return [];

  const { data: teams, error } = await supabase
    .from("teams")
    .select("captain_id, captain:players(email)")
    .in("id", teamIds);

  if (error) throw error;

  const emails: string[] = [];
  for (const team of teams ?? []) {
    const captain = unwrapOne(
      team.captain as { email: string | null } | { email: string | null }[] | null,
    );
    const email = captain?.email?.trim();
    if (email) emails.push(email);
  }
  return emails;
}

async function loadCompetitionManagerEmails(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["competition_manager", "system_admin"]);

  if (roleError) throw roleError;

  const userIds = [...new Set((roleRows ?? []).map((r) => r.user_id))];
  const emails: string[] = [];

  for (const userId of userIds) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (!error && data.user?.email) {
      emails.push(data.user.email);
    }
  }
  return emails;
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

export async function loadPostponementProposedCc(
  homeTeamId: string,
  awayTeamId: string,
): Promise<string[]> {
  const supabase = createServiceClient();
  const [captainEmails, managerEmails] = await Promise.all([
    loadCaptainEmailsForTeams(supabase, [homeTeamId, awayTeamId]),
    loadCompetitionManagerEmails(supabase),
  ]);
  return uniqueEmails([...captainEmails, ...managerEmails]);
}

/** Sends postponement-proposed email via Make.com (CC: both captains + competition managers). */
export async function sendPostponementProposedEmail(
  ctx: PostponementProposedEmailContext,
  homeTeamId: string,
  awayTeamId: string,
  locale?: string | null,
): Promise<void> {
  const cc = await loadPostponementProposedCc(homeTeamId, awayTeamId);
  if (cc.length === 0) return;

  const emailContext = await loadEmailTemplateContext(locale);
  const matchUrl = matchPostponementUrl(ctx.matchId);
  const { subject, bodyText, bodyHtml } = buildPostponementProposedEmail(
    ctx,
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
    },
    { eventType: "postponement_proposed" },
  );
}

/** Sends postponement decision email via Make.com (CC: both captains + competition managers). */
export async function sendPostponementDecisionEmail(
  ctx: PostponementDecisionEmailContext,
  homeTeamId: string,
  awayTeamId: string,
  locale?: string | null,
): Promise<void> {
  const cc = await loadPostponementProposedCc(homeTeamId, awayTeamId);
  if (cc.length === 0) return;

  const emailContext = await loadEmailTemplateContext(locale);
  const matchUrl = matchPostponementUrl(ctx.matchId);
  const loginUrl = loginThenMatchUrl(ctx.matchId);
  const { subject, bodyText, bodyHtml } = buildPostponementDecisionEmail(
    ctx,
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
    },
    { eventType: eventTypeByAction[ctx.action] },
  );
}
