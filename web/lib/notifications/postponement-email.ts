import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server-client";
import { formatBrussels } from "@/lib/time/brussels";

export type PostponementProposedEmailContext = {
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  previousDatetime: string;
  proposedDatetime: string;
  proposingTeamName: string;
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
  const path = `/player/matches/${matchId}`;
  return `${getAppBaseUrl()}${path}`;
}

export function loginThenMatchUrl(matchId: string): string {
  const next = encodeURIComponent(`/player/matches/${matchId}`);
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

function buildProposedEmailContent(ctx: PostponementProposedEmailContext): {
  subject: string;
  bodyText: string;
  bodyHtml: string;
} {
  const matchUrl = matchPostponementUrl(ctx.matchId);
  const previous = formatBrussels(ctx.previousDatetime);
  const proposed = formatBrussels(ctx.proposedDatetime);

  const subject = `Reschedule request: ${ctx.homeTeamName} vs ${ctx.awayTeamName} (round ${ctx.round})`;

  const bodyText = [
    `${ctx.proposingTeamName} proposed a new date for this match.`,
    "",
    `Round ${ctx.round}: ${ctx.homeTeamName} vs ${ctx.awayTeamName}`,
    `Current date: ${previous}`,
    `Proposed date: ${proposed}`,
    "",
    `Open the match to approve or reject:`,
    matchUrl,
  ].join("\n");

  const bodyHtml = [
    `<p><strong>${ctx.proposingTeamName}</strong> proposed a new date for this match.</p>`,
    `<p><strong>Round ${ctx.round}:</strong> ${ctx.homeTeamName} vs ${ctx.awayTeamName}<br>`,
    `Current date: ${previous}<br>`,
    `Proposed date: ${proposed}</p>`,
    `<p><a href="${matchUrl}">Open match to approve or reject</a></p>`,
  ].join("");

  return { subject, bodyText, bodyHtml };
}

/** Sends postponement-proposed email via Make.com (CC: both captains + competition managers). */
export async function sendPostponementProposedEmail(
  ctx: PostponementProposedEmailContext,
  homeTeamId: string,
  awayTeamId: string,
): Promise<void> {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) return;

  const cc = await loadPostponementProposedCc(homeTeamId, awayTeamId);
  if (cc.length === 0) return;

  const { subject, bodyText, bodyHtml } = buildProposedEmailContent(ctx);
  const matchUrl = matchPostponementUrl(ctx.matchId);

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "postponement_proposed",
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
        notified_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Retry handling deferred to task 5.6
  }
}
