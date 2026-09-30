import {
  buildArbiterRequestAssignedEmail,
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

export type ArbiterRequestAssignedEmailContext = {
  requestId: string;
  assignedArbiterId: string;
};

export type ArbiterRequestResolvedEmailContext = {
  requestId: string;
  rulingSignedUrl?: string | null;
};

async function emailsForUserIds(userIds: string[]): Promise<string[]> {
  const supabase = createServiceClient();
  const emails: string[] = [];
  for (const userId of [...new Set(userIds)]) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (!error && data.user?.email) {
      emails.push(data.user.email);
    }
  }
  return emails;
}

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

  return uniqueEmails(emails);
}

async function loadMatchCompetitionKindId(
  matchId: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: matchRow, error: matchError } = await supabase
    .from("matches")
    .select(
      "id, groups!inner(divisions!inner(leagues!inner(competition_kind_id)))",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (matchError) throw matchError;

  const groups = matchRow?.groups as
    | { divisions: { leagues: { competition_kind_id: string } } }
    | { divisions: { leagues: { competition_kind_id: string } } }[]
    | null
    | undefined;
  const group = Array.isArray(groups) ? groups[0] : groups;
  return group?.divisions?.leagues?.competition_kind_id ?? null;
}

async function loadCompetitionManagerEmails(matchId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const kindId = await loadMatchCompetitionKindId(matchId);
  if (!kindId) return [];

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["competition_manager", "system_admin"]);
  if (roleError) throw roleError;

  const { data: scopeRows, error: scopeError } = await supabase
    .from("competition_manager_scopes")
    .select("user_id, competition_kind_id");
  if (scopeError) throw scopeError;

  const scopesByUser = new Map<string, string[]>();
  for (const row of scopeRows ?? []) {
    const list = scopesByUser.get(row.user_id) ?? [];
    list.push(row.competition_kind_id);
    scopesByUser.set(row.user_id, list);
  }

  const recipientIds: string[] = [];
  for (const row of roleRows ?? []) {
    if (row.role === "system_admin") {
      recipientIds.push(row.user_id);
      continue;
    }
    const scopes = scopesByUser.get(row.user_id);
    if (!scopes || scopes.length === 0 || scopes.includes(kindId)) {
      recipientIds.push(row.user_id);
    }
  }

  return uniqueEmails(await emailsForUserIds(recipientIds));
}

async function loadChiefArbiterEmails(matchId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const kindId = await loadMatchCompetitionKindId(matchId);
  if (!kindId) return [];

  const { data: scopeRows, error: scopeError } = await supabase
    .from("arbiter_competition_scopes")
    .select("user_id")
    .eq("competition_kind_id", kindId)
    .eq("is_chief", true);
  if (scopeError) throw scopeError;

  const userIds = (scopeRows ?? []).map((r) => r.user_id);
  if (userIds.length === 0) return [];

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "arbiter")
    .in("user_id", userIds);
  if (roleError) throw roleError;

  return uniqueEmails(
    await emailsForUserIds((roleRows ?? []).map((r) => r.user_id)),
  );
}

async function loadAssignedArbiterEmail(
  assignedArbiterId: string | null | undefined,
): Promise<string[]> {
  if (!assignedArbiterId) return [];
  return uniqueEmails(await emailsForUserIds([assignedArbiterId]));
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

/** Create: managers + chief only. */
async function loadCreatedCc(matchId: string): Promise<string[]> {
  const [managerEmails, chiefEmails] = await Promise.all([
    loadCompetitionManagerEmails(matchId),
    loadChiefArbiterEmails(matchId),
  ]);
  return uniqueEmails([...managerEmails, ...chiefEmails]);
}

/** Resolve: managers + chief + assigned + captains. */
async function loadResolvedCc(
  matchId: string,
  assignedArbiterId: string | null,
): Promise<string[]> {
  const [managerEmails, chiefEmails, assignedEmails, captainEmails] =
    await Promise.all([
      loadCompetitionManagerEmails(matchId),
      loadChiefArbiterEmails(matchId),
      loadAssignedArbiterEmail(assignedArbiterId),
      loadCaptainEmailsForMatch(matchId),
    ]);
  return uniqueEmails([
    ...managerEmails,
    ...chiefEmails,
    ...assignedEmails,
    ...captainEmails,
  ]);
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
  const cc = await loadCreatedCc(ctx.matchId);
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
  assignedArbiterId: string | null;
} | null> {
  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from("arbiter_requests")
    .select("match_id, description, assigned_arbiter_id")
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
    assignedArbiterId: row.assigned_arbiter_id ?? null,
  };
}

export async function sendArbiterRequestAssignedEmail(
  ctx: ArbiterRequestAssignedEmailContext,
  locale?: string | null,
): Promise<void> {
  const summary = await loadArbiterRequestSummary(ctx.requestId, locale);
  if (!summary) return;

  const cc = await loadAssignedArbiterEmail(ctx.assignedArbiterId);
  if (cc.length === 0) return;

  const emailContext = await loadEmailTemplateContext(locale);
  const baseUrl = getAppBaseUrl();
  const matchUrl = `${baseUrl}/matches/${summary.matchId}`;
  const loginUrl = loginThenMatchUrl(summary.matchId);
  const inboxUrl = `${baseUrl}/arbiter`;

  const { subject, bodyText, bodyHtml } = buildArbiterRequestAssignedEmail(
    {
      round: summary.round,
      homeTeamName: summary.homeTeamName,
      awayTeamName: summary.awayTeamName,
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
      match_id: summary.matchId,
      match_url: matchUrl,
      login_url: loginUrl,
      arbiter_inbox_url: inboxUrl,
      request_id: ctx.requestId,
      assigned_arbiter_id: ctx.assignedArbiterId,
    },
    { eventType: "arbiter_request_assigned" },
  );
}

export async function sendArbiterRequestResolvedEmail(
  ctx: ArbiterRequestResolvedEmailContext,
  locale?: string | null,
): Promise<void> {
  const summary = await loadArbiterRequestSummary(ctx.requestId, locale);
  if (!summary) return;

  const [cc, emailContext] = await Promise.all([
    loadResolvedCc(summary.matchId, summary.assignedArbiterId),
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
