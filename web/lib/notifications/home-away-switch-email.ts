import {
  buildHomeAwaySwitchDecisionEmail,
  buildHomeAwaySwitchProposedEmail,
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
import { loginThenMatchUrl, matchPostponementUrl } from "./postponement-email";
import { sendResendEmail } from "./resend-email";

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

async function loadHomeAwaySwitchRecipients(
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

async function sendHomeAwaySwitchMail(
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
  to: string[],
  logLabel: string,
  locale?: string | null,
): Promise<void> {
  const [captainFields, emailContext, competitionKind] = await Promise.all([
    loadCaptainContactFields(homeTeamId, awayTeamId, ctx.requestingTeamId),
    loadEmailTemplateContext(locale),
    loadMatchCompetitionKindCode(ctx.matchId),
  ]);
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
          ...captainFields,
        },
        matchUrl,
        loginUrl,
        emailContext,
      )
    : buildHomeAwaySwitchProposedEmail(
        { ...ctx, ...captainFields },
        matchUrl,
        loginUrl,
        emailContext,
      );

  await sendResendEmail({
    to,
    subject,
    html: bodyHtml,
    text: bodyText,
    competitionKind: competitionKind ?? undefined,
    logLabel,
  });
}

/** Send Resend notification when a home/away switch request is proposed. */
export async function sendHomeAwaySwitchProposedEmail(
  ctx: HomeAwaySwitchProposedEmailContext,
  homeTeamId: string,
  awayTeamId: string,
  locale?: string | null,
): Promise<void> {
  const to = await loadHomeAwaySwitchRecipients(homeTeamId, awayTeamId);
  if (to.length === 0) return;
  await sendHomeAwaySwitchMail(
    ctx,
    homeTeamId,
    awayTeamId,
    to,
    "home_away_switch_proposed",
    locale,
  );
}

/** Send Resend notification when a home/away switch request is approved/rejected/cancelled. */
export async function sendHomeAwaySwitchDecisionEmail(
  ctx: HomeAwaySwitchDecisionEmailContext,
  homeTeamId: string,
  awayTeamId: string,
  locale?: string | null,
): Promise<void> {
  const to = await loadHomeAwaySwitchRecipients(homeTeamId, awayTeamId);
  if (to.length === 0) return;

  const logLabelByAction: Record<HomeAwaySwitchDecision, string> = {
    approve: "home_away_switch_approved",
    reject: "home_away_switch_rejected",
    cancel: "home_away_switch_cancelled",
  };

  await sendHomeAwaySwitchMail(
    { ...ctx, action: ctx.action },
    homeTeamId,
    awayTeamId,
    to,
    logLabelByAction[ctx.action],
    locale,
  );
}
