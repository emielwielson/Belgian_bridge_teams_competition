import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildHomeAwaySwitchDecisionEmail,
  buildHomeAwaySwitchProposedEmail,
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
import { loginThenMatchUrl, matchPostponementUrl } from "./postponement-email";
import { sendMakeWebhook, type MakeWebhookEventType } from "./make-webhook";

export type HomeAwaySwitchProposedEmailContext = {
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  requestingTeamName: string;
  requestingTeamId: string;
};

export type HomeAwaySwitchDecision = "approve" | "reject" | "cancel";

export type HomeAwaySwitchDecisionEmailContext = {
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  requestingTeamName: string;
  requestingTeamId: string;
  action: HomeAwaySwitchDecision;
};

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
  const [contacts, managerEmails] = await Promise.all([
    loadCaptainContactsForTeams(supabase, [homeTeamId, awayTeamId]),
    loadCompetitionManagerEmails(supabase),
  ]);
  return uniqueEmails([...captainEmailsFromContacts(contacts), ...managerEmails]);
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

async function sendPayload(
  eventType: MakeWebhookEventType,
  ctx: {
    matchId: string;
    round: number;
    homeTeamName: string;
    awayTeamName: string;
    requestingTeamName: string;
    requestingTeamId: string;
    action?: HomeAwaySwitchDecision;
  },
  homeTeamId: string,
  awayTeamId: string,
  cc: string[],
  locale?: string | null,
): Promise<boolean> {
  const { captainFields, webhookFields } = await loadCaptainContactFields(
    homeTeamId,
    awayTeamId,
    ctx.requestingTeamId,
  );

  const emailContext = await loadEmailTemplateContext(locale);
  const matchUrl = matchPostponementUrl(ctx.matchId);
  const loginUrl = loginThenMatchUrl(ctx.matchId);

  const buildCtx = { ...ctx, ...captainFields };

  const { subject, bodyText, bodyHtml } = ctx.action
    ? buildHomeAwaySwitchDecisionEmail(
        {
          matchId: ctx.matchId,
          round: ctx.round,
          homeTeamName: ctx.homeTeamName,
          awayTeamName: ctx.awayTeamName,
          requestingTeamName: ctx.requestingTeamName,
          action: ctx.action,
          ...captainFields,
        },
        matchUrl,
        loginUrl,
        emailContext,
      )
    : buildHomeAwaySwitchProposedEmail(
        buildCtx,
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
      ...webhookFields,
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
  await sendPayload("home_away_switch_proposed", ctx, homeTeamId, awayTeamId, cc, locale);
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
    homeTeamId,
    awayTeamId,
    cc,
    locale,
  );
}
