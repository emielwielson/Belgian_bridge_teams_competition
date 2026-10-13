import {
  buildLocationChangeDecisionEmail,
  buildLocationChangeProposedEmail,
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

export type LocationChangeProposedEmailContext = {
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  proposingTeamName: string;
  proposingTeamId: string;
  proposedLocation: string;
};

export type LocationChangeDecision = "approve" | "reject" | "cancel";

export type LocationChangeDecisionEmailContext = {
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  proposingTeamName: string;
  proposingTeamId: string;
  proposedLocation: string;
  action: LocationChangeDecision;
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

async function loadLocationChangeRecipients(
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
  proposingTeamId: string,
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
    proposingTeamId,
  );
  return toCaptainContactFields(requesting, receiving);
}

async function sendLocationChangeMail(
  ctx: {
    matchId: string;
    round: number;
    homeTeamName: string;
    awayTeamName: string;
    proposingTeamName: string;
    proposingTeamId: string;
    proposedLocation: string;
    action?: LocationChangeDecision;
  },
  homeTeamId: string,
  awayTeamId: string,
  to: string[],
  logLabel: string,
  locale?: string | null,
): Promise<void> {
  const [captainFields, emailContext, competitionKind] = await Promise.all([
    loadCaptainContactFields(homeTeamId, awayTeamId, ctx.proposingTeamId),
    loadEmailTemplateContext(locale),
    loadMatchCompetitionKindCode(ctx.matchId),
  ]);
  const matchUrl = matchPostponementUrl(ctx.matchId);
  const loginUrl = loginThenMatchUrl(ctx.matchId);

  const { subject, bodyText, bodyHtml } = ctx.action
    ? buildLocationChangeDecisionEmail(
        {
          matchId: ctx.matchId,
          round: ctx.round,
          homeTeamName: ctx.homeTeamName,
          awayTeamName: ctx.awayTeamName,
          proposingTeamName: ctx.proposingTeamName,
          proposedLocation: ctx.proposedLocation,
          action: ctx.action,
          ...captainFields,
        },
        matchUrl,
        loginUrl,
        emailContext,
      )
    : buildLocationChangeProposedEmail(
        {
          matchId: ctx.matchId,
          round: ctx.round,
          homeTeamName: ctx.homeTeamName,
          awayTeamName: ctx.awayTeamName,
          proposingTeamName: ctx.proposingTeamName,
          proposedLocation: ctx.proposedLocation,
          ...captainFields,
        },
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

export async function sendLocationChangeProposedEmail(
  ctx: LocationChangeProposedEmailContext,
  homeTeamId: string,
  awayTeamId: string,
  locale?: string | null,
): Promise<void> {
  const to = await loadLocationChangeRecipients(homeTeamId, awayTeamId);
  if (to.length === 0) return;
  await sendLocationChangeMail(
    ctx,
    homeTeamId,
    awayTeamId,
    to,
    "location_change_proposed",
    locale,
  );
}

export async function sendLocationChangeDecisionEmail(
  ctx: LocationChangeDecisionEmailContext,
  homeTeamId: string,
  awayTeamId: string,
  locale?: string | null,
): Promise<void> {
  const to = await loadLocationChangeRecipients(homeTeamId, awayTeamId);
  if (to.length === 0) return;

  const logLabelByAction: Record<LocationChangeDecision, string> = {
    approve: "location_change_approved",
    reject: "location_change_rejected",
    cancel: "location_change_cancelled",
  };

  await sendLocationChangeMail(
    { ...ctx, action: ctx.action },
    homeTeamId,
    awayTeamId,
    to,
    logLabelByAction[ctx.action],
    locale,
  );
}
