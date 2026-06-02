import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildHomeAwaySwitchDecisionEmail,
  buildHomeAwaySwitchProposedEmail,
  loadEmailTemplateContext,
} from "@/lib/i18n/email-templates";
import { createServiceClient } from "@/lib/supabase/server-client";
import { loginThenMatchUrl, matchPostponementUrl } from "./postponement-email";
import { sendMakeWebhook, type MakeWebhookEventType } from "./make-webhook";

export type HomeAwaySwitchProposedEmailContext = {
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  requestingTeamName: string;
};

export type HomeAwaySwitchDecision = "approve" | "reject" | "cancel";

export type HomeAwaySwitchDecisionEmailContext = {
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  requestingTeamName: string;
  action: HomeAwaySwitchDecision;
};

function unwrapOne<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function loadCaptainEmailsForTeams(
  supabase: SupabaseClient,
  teamIds: string[],
): Promise<string[]> {
  if (teamIds.length === 0) return [];
  const { data: teams, error } = await supabase
    .from("teams")
    .select("captain:players(email)")
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
    if (!error && data.user?.email) emails.push(data.user.email);
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

async function loadHomeAwaySwitchCc(
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

async function sendPayload(
  eventType: MakeWebhookEventType,
  ctx: {
    matchId: string;
    round: number;
    homeTeamName: string;
    awayTeamName: string;
    requestingTeamName: string;
    action?: HomeAwaySwitchDecision;
  },
  cc: string[],
  locale?: string | null,
): Promise<boolean> {
  const emailContext = await loadEmailTemplateContext(locale);
  const matchUrl = matchPostponementUrl(ctx.matchId);
  const loginUrl = loginThenMatchUrl(ctx.matchId);

  const { subject, bodyText, bodyHtml } = ctx.action
    ? buildHomeAwaySwitchDecisionEmail(
        {
          matchId: ctx.matchId,
          round: ctx.round,
          homeTeamName: ctx.homeTeamName,
          awayTeamName: ctx.awayTeamName,
          requestingTeamName: ctx.requestingTeamName,
          action: ctx.action,
        },
        matchUrl,
        loginUrl,
        emailContext,
      )
    : buildHomeAwaySwitchProposedEmail(
        ctx,
        matchUrl,
        loginUrl,
        emailContext,
      );

  const actionLabel = ctx.action
    ? {
        approve: emailContext.t("homeAwaySwitchDecision.approved"),
        reject: emailContext.t("homeAwaySwitchDecision.rejected"),
        cancel: emailContext.t("homeAwaySwitchDecision.cancelled"),
      }[ctx.action]
    : "proposed";

  return sendMakeWebhook(
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
      requesting_team_name: ctx.requestingTeamName,
      action: actionLabel,
    },
    { eventType },
  );
}

/** Send Make notification when a home/away switch request is proposed. */
export async function sendHomeAwaySwitchProposedEmail(
  ctx: HomeAwaySwitchProposedEmailContext,
  homeTeamId: string,
  awayTeamId: string,
  locale?: string | null,
): Promise<void> {
  const cc = await loadHomeAwaySwitchCc(homeTeamId, awayTeamId);
  if (cc.length === 0) return;
  await sendPayload("home_away_switch_proposed", ctx, cc, locale);
}

/** Send Make notification when a home/away switch request is approved/rejected/cancelled. */
export async function sendHomeAwaySwitchDecisionEmail(
  ctx: HomeAwaySwitchDecisionEmailContext,
  homeTeamId: string,
  awayTeamId: string,
  locale?: string | null,
): Promise<void> {
  const cc = await loadHomeAwaySwitchCc(homeTeamId, awayTeamId);
  if (cc.length === 0) return;

  const eventTypeByAction: Record<HomeAwaySwitchDecision, MakeWebhookEventType> = {
    approve: "home_away_switch_approved",
    reject: "home_away_switch_rejected",
    cancel: "home_away_switch_cancelled",
  };

  await sendPayload(
    eventTypeByAction[ctx.action],
    { ...ctx, action: ctx.action },
    cc,
    locale,
  );
}
