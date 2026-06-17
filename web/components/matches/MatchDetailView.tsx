import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { MatchPenaltyForm } from "@/components/matches/MatchPenaltyForm";
import { MatchSecondaryWorkflows } from "@/components/matches/MatchSecondaryWorkflows";
import { MatchLineupEditor } from "@/components/player/MatchLineupEditor";
import { MatchScoreForm } from "@/components/player/MatchScoreForm";
import {
  canEditLineupForTeam,
  canSubmitScore,
  canViewMatchOps,
  type MatchContext,
} from "@/lib/auth/match-access";
import { COMPETITION_ADMIN_ROLES } from "@/lib/auth/route-auth";
import { ARBITER_ACCESS_ROLES, FINISHED_SCORE_EDIT_ROLES, hasAnyRole } from "@/lib/auth/roles";
import {
  canAccessPostponementWorkflow,
  getMatchPostponementState,
} from "@/lib/competition/postponement";
import {
  canAccessArbiterRequestWorkflow,
  loadMatchArbiterRequestsForUser,
} from "@/lib/competition/arbiter-request";
import {
  canAccessHomeAwaySwitchWorkflow,
  getMatchHomeAwaySwitchState,
} from "@/lib/competition/home-away-switch";
import type { MatchPageBackLink } from "@/lib/competition/match-page-context";
import { loadGroupScoringContext } from "@/lib/competition/match-scoring-context";
import { loadTeamRoster } from "@/lib/competition/player-matches";
import { translateLeagueName } from "@/lib/i18n/labels";
import { allowsBoardChoice } from "@/lib/scoring/board-count-rules";
import { getMatchLineup, isLineupComplete } from "@/lib/scoring/match-operations";
import { matchStatus } from "@/lib/scoring/match-state";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { Locale } from "@/i18n/config";
import { formatBrussels } from "@/lib/time/brussels";
import type { SupabaseClient } from "@supabase/supabase-js";

type Props = {
  supabase: SupabaseClient;
  match: MatchContext;
  matchId: string;
  backLink: MatchPageBackLink;
  userId: string | null;
  roles: string[];
};

function backLinkLabel(
  backLink: MatchPageBackLink,
  t: Awaited<ReturnType<typeof getTranslations>>,
  tRegions: Awaited<ReturnType<typeof getTranslations>>,
): string {
  if (backLink.leagueName && backLink.groupName) {
    return t("backLeagueGroup", {
      leagueName: translateLeagueName(backLink.leagueName, tRegions),
      groupName: backLink.groupName,
    });
  }
  if (backLink.groupName) {
    return t("backGroupOnly", { groupName: backLink.groupName });
  }
  return t("backStandings");
}

export async function MatchDetailView({
  supabase,
  match,
  matchId,
  backLink,
  userId,
  roles,
}: Props) {
  const [t, tStatus, tRegions] = await Promise.all([
    getTranslations("match"),
    getTranslations("match.status"),
    getTranslations("regions"),
  ]);
  const locale = (await getLocale()) as Locale;
  const intlLocale = toIntlLocale(locale);

  const canOps = userId
    ? await canViewMatchOps(supabase, matchId)
    : false;
  const canSubmitScoreForMatch = userId
    ? await canSubmitScore(supabase, matchId)
    : false;

  const lineup = await getMatchLineup(supabase, matchId);
  const [homeRoster, awayRoster] = await Promise.all([
    loadTeamRoster(supabase, match.home_team_id),
    loadTeamRoster(supabase, match.away_team_id),
  ]);

  const isAdmin = userId
    ? hasAnyRole(roles, [...COMPETITION_ADMIN_ROLES])
    : false;
  const canEditFinishedScore = userId
    ? hasAnyRole(roles, [...FINISHED_SCORE_EDIT_ROLES])
    : false;
  const canAddPenalty = userId
    ? hasAnyRole(roles, [...ARBITER_ACCESS_ROLES])
    : false;
  const [canEditHome, canEditAway] =
    userId && canOps
      ? await Promise.all([
          canEditLineupForTeam(
            supabase,
            userId,
            roles,
            match,
            match.home_team_id,
          ),
          canEditLineupForTeam(
            supabase,
            userId,
            roles,
            match,
            match.away_team_id,
          ),
        ])
      : [false, false];

  const lineupsComplete = await isLineupComplete(supabase, match);
  const scoringContext = await loadGroupScoringContext(supabase, match.group_id);
  const showBoardChoice = allowsBoardChoice(scoringContext);
  const status = matchStatus(match.played_at);

  let postponementState = null;
  let homeAwaySwitchState = null;
  let arbiterRequestsState = null;
  if (userId) {
    postponementState = await getMatchPostponementState(supabase, matchId);
    try {
      homeAwaySwitchState = await getMatchHomeAwaySwitchState(
        supabase,
        matchId,
      );
    } catch {
      // Migration 0022 not applied yet.
    }
    try {
      const loaded = await loadMatchArbiterRequestsForUser(supabase, matchId);
      arbiterRequestsState = loaded.state;
    } catch {
      // Migration 0026 not applied yet.
    }
  }

  const showPostpone =
    canOps &&
    postponementState != null &&
    canAccessPostponementWorkflow(postponementState);
  const showHomeAwaySwitch =
    canOps &&
    homeAwaySwitchState != null &&
    canAccessHomeAwaySwitchWorkflow(homeAwaySwitchState);
  const showArbiterRequests =
    canSubmitScoreForMatch ||
    (arbiterRequestsState != null &&
      canAccessArbiterRequestWorkflow(
        arbiterRequestsState,
        canSubmitScoreForMatch,
      ));

  const homeLineup = lineup
    .filter((e) => e.team_id === match.home_team_id)
    .map((e) => ({
      player_id: e.player_id,
      is_substitute: e.is_substitute,
      player: e.player,
    }));
  const awayLineup = lineup
    .filter((e) => e.team_id === match.away_team_id)
    .map((e) => ({
      player_id: e.player_id,
      is_substitute: e.is_substitute,
      player: e.player,
    }));

  const opsBackLink =
    userId && canOps
      ? isAdmin
        ? { href: "/admin", label: t("backAdminDashboard") }
        : { href: "/player", label: t("backPlayerDashboard") }
      : null;

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href={backLink.href} className="link-back">
          {backLinkLabel(backLink, t, tRegions)}
        </Link>
        {opsBackLink ? (
          <p className="mt-2">
            <Link href={opsBackLink.href} className="text-sm text-zinc-600 hover:underline">
              {opsBackLink.label}
            </Link>
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {t("title", {
            round: match.round,
            homeTeam: match.home_team.name,
            awayTeam: match.away_team.name,
          })}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {formatBrussels(match.datetime, intlLocale)}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={
              status === "played"
                ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                : "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700"
            }
          >
            {status === "played" ? tStatus("played") : tStatus("scheduled")}
          </span>
          {match.played_at ? (
            <span className="text-xs text-zinc-500">
              {tStatus("scoredAt", {
                datetime: formatBrussels(match.played_at, intlLocale),
              })}
            </span>
          ) : null}
        </p>
        {!userId ? (
          <p className="mt-3 text-sm text-zinc-600">
            {t.rich("signInPrompt", {
              link: (chunks) => (
                <Link
                  href={`/login?next=/matches/${matchId}`}
                  className="font-medium text-emerald-800 hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        ) : null}
      </header>

      {showPostpone || showArbiterRequests || showHomeAwaySwitch ? (
        <MatchSecondaryWorkflows
          matchId={matchId}
          showPostpone={showPostpone}
          showArbiter={showArbiterRequests}
          showHomeAwaySwitch={showHomeAwaySwitch}
          postpone={
            showPostpone
              ? {
                  homeTeamName: match.home_team.name,
                  awayTeamName: match.away_team.name,
                  homeTeamId: match.home_team_id,
                  awayTeamId: match.away_team_id,
                }
              : null
          }
          homeAwaySwitch={
            showHomeAwaySwitch && homeAwaySwitchState
              ? {
                  matchId,
                  homeTeamName: match.home_team.name,
                  awayTeamName: match.away_team.name,
                  homeTeamId: match.home_team_id,
                  awayTeamId: match.away_team_id,
                  initialState: homeAwaySwitchState,
                }
              : null
          }
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <MatchLineupEditor
          matchId={matchId}
          teamId={match.home_team_id}
          teamName={match.home_team.name}
          roster={homeRoster}
          initialLineup={homeLineup}
          canEdit={canEditHome}
        />
        <MatchLineupEditor
          matchId={matchId}
          teamId={match.away_team_id}
          teamName={match.away_team.name}
          roster={awayRoster}
          initialLineup={awayLineup}
          canEdit={canEditAway}
        />
      </div>

      <MatchScoreForm
        matchId={matchId}
        scheduledBoardCount={match.board_count}
        allowsBoardChoice={showBoardChoice}
        initialImpsHome={match.imps_home}
        initialImpsAway={match.imps_away}
        initialVpHome={match.vp_home}
        initialVpAway={match.vp_away}
        initialMisSeating={match.mis_seating}
        initialSelectedBoardCount={match.selected_board_count}
        initialVpBoardCount={match.vp_board_count}
        playedAt={match.played_at}
        isAdmin={isAdmin}
        canEditFinishedScore={canEditFinishedScore}
        lineupsComplete={lineupsComplete}
        allowSubmit={canSubmitScoreForMatch}
      />

      {canAddPenalty ? (
        <MatchPenaltyForm
          homeTeam={{ id: match.home_team_id, name: match.home_team.name }}
          awayTeam={{ id: match.away_team_id, name: match.away_team.name }}
        />
      ) : null}
    </main>
  );
}
