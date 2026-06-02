import { createServiceClient } from "@/lib/supabase/server-client";
import { getAppBaseUrl, loginThenMatchUrl } from "./postponement-email";
import { sendMakeWebhook } from "./make-webhook";

export type ArbiterRequestCreatedEmailContext = {
  matchId: string;
};

export type ArbiterRequestResolvedEmailContext = {
  requestId: string;
};

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

  const seen = new Set<string>();
  return emails.filter((e) => {
    const key = e.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadMatchSummary(matchId: string): Promise<{
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

  return {
    round: match.round,
    homeTeamName: (home as { name?: string } | null)?.name ?? "Home",
    awayTeamName: (away as { name?: string } | null)?.name ?? "Away",
  };
}

export async function sendArbiterRequestCreatedEmail(
  ctx: ArbiterRequestCreatedEmailContext,
): Promise<void> {
  const cc = await loadArbiterEmails();
  if (cc.length === 0) return;

  const summary = await loadMatchSummary(ctx.matchId);
  const baseUrl = getAppBaseUrl();
  const matchUrl = `${baseUrl}/matches/${ctx.matchId}`;
  const loginUrl = loginThenMatchUrl(ctx.matchId);
  const inboxUrl = `${baseUrl}/arbiter`;

  const matchLine = summary
    ? `Round ${summary.round}: ${summary.homeTeamName} vs ${summary.awayTeamName}`
    : `Match ${ctx.matchId}`;

  const subject = `Arbiter request: ${matchLine}`;
  const bodyText = [
    "A team captain submitted an arbiter request with an attachment.",
    "",
    matchLine,
    "",
    `Arbiter inbox: ${inboxUrl}`,
    `Match: ${matchUrl}`,
    `Login first: ${loginUrl}`,
  ].join("\n");

  const bodyHtml = [
    "<p>A team captain submitted an arbiter request with an attachment.</p>",
    `<p><strong>${matchLine}</strong></p>`,
    `<p><a href="${inboxUrl}">Open arbiter inbox</a> · <a href="${matchUrl}">View match</a><br><a href="${loginUrl}">Login first</a></p>`,
  ].join("");

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
): Promise<{
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  board: number | null;
  description: string | null;
} | null> {
  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from("arbiter_requests")
    .select("match_id, board, description")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !row) return null;

  const match = await loadMatchSummary(row.match_id);
  if (!match) return null;

  return {
    matchId: row.match_id,
    round: match.round,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    board: row.board,
    description: row.description?.trim() ? row.description : null,
  };
}

function legacyDetailLines(summary: {
  board: number | null;
  description: string | null;
}): string[] {
  const lines: string[] = [];
  if (summary.board != null) lines.push(`Board: ${summary.board}`);
  if (summary.description) lines.push(`Description: ${summary.description}`);
  return lines;
}

export async function sendArbiterRequestResolvedEmail(
  ctx: ArbiterRequestResolvedEmailContext,
): Promise<void> {
  const cc = await loadArbiterEmails();
  if (cc.length === 0) return;

  const summary = await loadArbiterRequestSummary(ctx.requestId);
  if (!summary) return;

  const baseUrl = getAppBaseUrl();
  const matchUrl = `${baseUrl}/matches/${summary.matchId}`;
  const loginUrl = loginThenMatchUrl(summary.matchId);
  const inboxUrl = `${baseUrl}/arbiter`;
  const matchLine = `Round ${summary.round}: ${summary.homeTeamName} vs ${summary.awayTeamName}`;
  const legacyLines = legacyDetailLines(summary);

  const subject = `Arbiter request resolved: ${matchLine}`;
  const bodyText = [
    "An arbiter request has been resolved.",
    "",
    matchLine,
    ...legacyLines,
    "",
    `Arbiter inbox: ${inboxUrl}`,
    `Match: ${matchUrl}`,
    `Login first: ${loginUrl}`,
  ].join("\n");

  const legacyHtml =
    legacyLines.length > 0
      ? `<br>${legacyLines.join("<br>")}`
      : "<br>See the attachment in the arbiter inbox.";

  const bodyHtml = [
    "<p>An arbiter request has been resolved.</p>",
    `<p><strong>${matchLine}</strong>${legacyHtml}</p>`,
    `<p><a href="${inboxUrl}">Open arbiter inbox</a> · <a href="${matchUrl}">View match</a><br><a href="${loginUrl}">Login first</a></p>`,
  ].join("");

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
      board: summary.board,
      description: summary.description,
    },
    { eventType: "arbiter_request_resolved" },
  );
}
