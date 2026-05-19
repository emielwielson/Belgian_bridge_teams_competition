import { createServiceClient } from "@/lib/supabase/server-client";
import { getAppBaseUrl } from "./postponement-email";
import { sendMakeWebhook } from "./make-webhook";

export type ArbiterRequestCreatedEmailContext = {
  matchId: string;
  board: number;
  description: string;
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
  const inboxUrl = `${baseUrl}/arbiter`;

  const matchLine = summary
    ? `Round ${summary.round}: ${summary.homeTeamName} vs ${summary.awayTeamName}`
    : `Match ${ctx.matchId}`;

  const subject = `Arbiter request: ${matchLine}, board ${ctx.board}`;
  const bodyText = [
    "A team captain submitted an arbiter request.",
    "",
    matchLine,
    `Board: ${ctx.board}`,
    `Description: ${ctx.description}`,
    "",
    `Arbiter inbox: ${inboxUrl}`,
    `Match: ${matchUrl}`,
  ].join("\n");

  const bodyHtml = [
    "<p>A team captain submitted an arbiter request.</p>",
    `<p><strong>${matchLine}</strong><br>Board: ${ctx.board}<br>${ctx.description}</p>`,
    `<p><a href="${inboxUrl}">Open arbiter inbox</a> · <a href="${matchUrl}">View match</a></p>`,
  ].join("");

  await sendMakeWebhook(
    {
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      cc,
      match_id: ctx.matchId,
      match_url: matchUrl,
      arbiter_inbox_url: inboxUrl,
      board: ctx.board,
      description: ctx.description,
    },
    { eventType: "arbiter_request_created" },
  );
}
