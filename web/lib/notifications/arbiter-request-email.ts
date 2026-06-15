import {
  buildArbiterRequestCreatedEmail,
  buildArbiterRequestResolvedEmail,
  loadEmailTemplateContext,
} from "@/lib/i18n/email-templates";
import { createServiceClient } from "@/lib/supabase/server-client";
import { getAppBaseUrl, loginThenMatchUrl } from "./postponement-email";
import { sendMakeWebhook } from "./make-webhook";

export type ArbiterRequestCreatedEmailContext = {
  matchId: string;
};

export type ArbiterRequestResolvedEmailContext = {
  requestId: string;
  rulingSignedUrl?: string | null;
};

async function loadCaptainEmailsForMatch(matchId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError || !match) return [];

  const teamIds = [match.home_team_id, match.away_team_id];
  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("captain_id, captain:players(id, email)")
    .in("id", teamIds);
  if (teamError) throw teamError;

  const emails: string[] = [];
  for (const team of teams ?? []) {
    const captain = Array.isArray(team.captain)
      ? team.captain[0]
      : team.captain;
    const captainPlayer = captain as { id?: string; email?: string | null } | null;
    if (!captainPlayer?.id) continue;

    const { data: links, error: linkError } = await supabase
      .from("player_auth_links")
      .select("auth_user_id")
      .eq("player_id", captainPlayer.id)
      .limit(1);
    if (linkError) throw linkError;

    const authUserId = links?.[0]?.auth_user_id;
    if (authUserId) {
      const { data, error } = await supabase.auth.admin.getUserById(authUserId);
      if (!error && data.user?.email) {
        emails.push(data.user.email);
        continue;
      }
    }

    const playerEmail = captainPlayer.email?.trim();
    if (playerEmail) emails.push(playerEmail);
  }

  const seen = new Set<string>();
  return emails.filter((e) => {
    const key = e.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadCompetitionManagerEmails(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["competition_manager", "system_admin"]);

  if (roleError) throw roleError;

  const emails: string[] = [];
  for (const row of roleRows ?? []) {
    const { data, error } = await supabase.auth.admin.getUserById(row.user_id);
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

async function loadArbiterRequestCc(matchId: string): Promise<string[]> {
  const [arbiterEmails, captainEmails, managerEmails] = await Promise.all([
    loadArbiterEmails(),
    loadCaptainEmailsForMatch(matchId),
    loadCompetitionManagerEmails(),
  ]);
  return uniqueEmails([...arbiterEmails, ...captainEmails, ...managerEmails]);
}

async function loadArbiterEmails(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "arbiter");

  if (roleError) throw roleError;

  const emails: string[] = [];
  for (const row of roleRows ?? []) {
    const { data, error } = await supabase.auth.admin.getUserById(row.user_id);
    if (!error && data.user?.email) {
      emails.push(data.user.email);
    }
  }

  return uniqueEmails(emails);
}

async function loadMatchSummary(
  matchId: string,
  locale?: string | null,
): Promise<{
  round: number;
  homeTeamName: string;
  awayTeamName: string;
} | null> {
  const supabase = createServiceClient();
  const { data: match, error } = await supabase
    .from("matches")
    .select(
      "round, home_team:teams!matches_home_team_id_fkey (name), away_team:teams!matches_away_team_id_fkey (name)",
    )
    .eq("id", matchId)
    .maybeSingle();

  if (error || !match) return null;

  const home = Array.isArray(match.home_team)
    ? match.home_team[0]
    : match.home_team;
  const away = Array.isArray(match.away_team)
    ? match.away_team[0]
    : match.away_team;

  const emailContext = await loadEmailTemplateContext(locale);

  return {
    round: match.round,
    homeTeamName:
      (home as { name?: string } | null)?.name ??
      emailContext.t("arbiterRequestCreated.homeFallback"),
    awayTeamName:
      (away as { name?: string } | null)?.name ??
      emailContext.t("arbiterRequestCreated.awayFallback"),
  };
}

export async function sendArbiterRequestCreatedEmail(
  ctx: ArbiterRequestCreatedEmailContext,
  locale?: string | null,
): Promise<void> {
  const cc = await loadArbiterRequestCc(ctx.matchId);
  if (cc.length === 0) return;

  const emailContext = await loadEmailTemplateContext(locale);
  const summary = await loadMatchSummary(ctx.matchId, locale);
  const baseUrl = getAppBaseUrl();
  const matchUrl = `${baseUrl}/matches/${ctx.matchId}`;
  const loginUrl = loginThenMatchUrl(ctx.matchId);
  const inboxUrl = `${baseUrl}/arbiter`;

  const { subject, bodyText, bodyHtml } = buildArbiterRequestCreatedEmail(
    {
      matchId: ctx.matchId,
      round: summary?.round,
      homeTeamName: summary?.homeTeamName,
      awayTeamName: summary?.awayTeamName,
      matchUrl,
      loginUrl,
      inboxUrl,
    },
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
      login_url: loginUrl,
      arbiter_inbox_url: inboxUrl,
    },
    { eventType: "arbiter_request_created" },
  );
}

async function loadArbiterRequestSummary(
  requestId: string,
  locale?: string | null,
): Promise<{
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  description: string | null;
} | null> {
  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from("arbiter_requests")
    .select("match_id, description")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !row) return null;

  const match = await loadMatchSummary(row.match_id, locale);
  if (!match) return null;

  return {
    matchId: row.match_id,
    round: match.round,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    description: row.description?.trim() ? row.description : null,
  };
}

export async function sendArbiterRequestResolvedEmail(
  ctx: ArbiterRequestResolvedEmailContext,
  locale?: string | null,
): Promise<void> {
  const summary = await loadArbiterRequestSummary(ctx.requestId, locale);
  if (!summary) return;

  const [cc, emailContext] = await Promise.all([
    loadArbiterRequestCc(summary.matchId),
    loadEmailTemplateContext(locale),
  ]);
  if (cc.length === 0) return;

  const baseUrl = getAppBaseUrl();
  const matchUrl = `${baseUrl}/matches/${summary.matchId}`;
  const loginUrl = loginThenMatchUrl(summary.matchId);
  const inboxUrl = `${baseUrl}/arbiter`;

  const { subject, bodyText, bodyHtml } = buildArbiterRequestResolvedEmail(
    {
      round: summary.round,
      homeTeamName: summary.homeTeamName,
      awayTeamName: summary.awayTeamName,
      description: summary.description,
      matchUrl,
      loginUrl,
      inboxUrl,
      rulingSignedUrl: ctx.rulingSignedUrl,
    },
    emailContext,
  );

  await sendMakeWebhook(
    {
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      cc,
      match_id: summary.matchId,
      match_url: matchUrl,
      login_url: loginUrl,
      arbiter_inbox_url: inboxUrl,
      request_id: ctx.requestId,
      description: summary.description,
      ruling_url: ctx.rulingSignedUrl ?? null,
    },
    { eventType: "arbiter_request_resolved" },
  );
}
