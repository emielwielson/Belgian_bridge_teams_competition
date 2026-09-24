import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { HonorMatchScorecardView } from "@/components/matches/HonorMatchScorecard";
import { MatchPenaltyForm } from "@/components/matches/MatchPenaltyForm";
import { MatchSecondaryWorkflows } from "@/components/matches/MatchSecondaryWorkflows";
import { HonorMatchLineupEditor } from "@/components/player/HonorMatchLineupEditor";
import { MatchLineupEditor } from "@/components/player/MatchLineupEditor";
import { MatchScoreForm } from "@/components/player/MatchScoreForm";
import {
  canEditLineupForTeam,
  canSubmitScore,
  canViewMatchOps,
  type MatchContext,
} from "@/lib/auth/match-access";
import { getArbiterAccess, hasArbiterHonorAccess } from "@/lib/auth/arbiter-scope";
import { COMPETITION_ADMIN_ROLES } from "@/lib/auth/roles";
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
import {
  honorPermissionsForViewer,
  loadHonorMatchLineupContext,
  resolveHonorViewerSide,
} from "@/lib/competition/honor-lineup-access";
import { loadHonorMatchScorecard } from "@/lib/competition/honor-match-scorecard";
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

  const honorCtx = await loadHonorMatchLineupContext(supabase, match);
  let honorPerms = null;
  if (honorCtx.isHonor) {
    const viewerSide =
      userId != null
        ? await resolveHonorViewerSide(supabase, userId, roles, match)
        : "other";
    const arbiterAccess =
      userId != null
        ? await getArbiterAccess(supabase, userId, roles)
        : null;
    honorPerms = honorPermissionsForViewer({
      viewerSide,
      phase: honorCtx.phase,
      homeLocked: honorCtx.homeLocked,
      awayLocked: honorCtx.awayLocked,
      played: match.played_at != null,
      roles,
      hasHonorAccess: arbiterAccess
        ? hasArbiterHonorAccess(arbiterAccess)
        : false,
    });
  }

  const lineupsComplete = await isLineupComplete(supabase, match);
  const scoringContext = await loadGroupScoringContext(supabase, match.group_id);
  const showBoardChoice = allowsBoardChoice(scoringContext);
  const status = matchStatus(match.played_at);

  const honorScorecard =
    honorCtx.isHonor
      ? await loadHonorMatchScorecard(
          supabase,
          match,
          lineup,
          honorCtx.venueTables,
        )
      : null;

  let postponementState = null;
  let homeAwaySwitchState = null;
  let arbiterRequestsState = null;
  // Honor: dates/venues are fixed and an arbiter is on site — no reschedule or remote arbiter request.
  if (userId) {
    if (!honorCtx.isHonor) {
      postponementState = await getMatchPostponementState(supabase, matchId);
      try {
        const loaded = await loadMatchArbiterRequestsForUser(supabase, matchId);
        arbiterRequestsState = loaded.state;
      } catch {
        // Migration 0026 not applied yet.
      }
    }
    try {
      homeAwaySwitchState = await getMatchHomeAwaySwitchState(
        supabase,
        matchId,
      );
    } catch {
      // Migration 0022 not applied yet.
    }
  }

  const showPostpone =
    !honorCtx.isHonor &&
    canOps &&
    postponementState != null &&
    canAccessPostponementWorkflow(postponementState);
  const showHomeAwaySwitch =
    canOps &&
    homeAwaySwitchState != null &&
    canAccessHomeAwaySwitchWorkflow(homeAwaySwitchState);
  const showArbiterRequests =
    !honorCtx.isHonor &&
    (canSubmitScoreForMatch ||
      (arbiterRequestsState != null &&
        canAccessArbiterRequestWorkflow(
          arbiterRequestsState,
          canSubmitScoreForMatch,
        )));

  const homeLineup = lineup
    .filter((e) => e.team_id === match.home_team_id)
    .map((e) => ({
      player_id: e.player_id,
      is_substitute: e.is_substitute,
      room: e.room,
      direction: e.direction,
      player: e.player,
    }));
  const awayLineup = lineup
    .filter((e) => e.team_id === match.away_team_id)
    .map((e) => ({
      player_id: e.player_id,
      is_substitute: e.is_substitute,
      room: e.room,
      direction: e.direction,
      player: e.player,
    }));

  const visibleHomeLineup =
    !honorCtx.isHonor || !honorPerms || honorPerms.canViewHome
      ? homeLineup
      : [];
  const visibleAwayLineup =
    !honorCtx.isHonor || !honorPerms || honorPerms.canViewAway
      ? awayLineup
      : [];

  const opsBackLink =
    userId && canOps && isAdmin
      ? { href: "/admin", label: t("backAdminDashboard") }
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
        {!userId && !match.played_at ? (
          <p className="mt-3 text-sm text-zinc-600">
            {t.rich(honorCtx.isHonor ? "signInPromptHonor" : "signInPrompt", {
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

      {/* Lineups are shown in the honor scorecard once results are published. */}
      {!honorScorecard ? (
        <>
          {honorCtx.isHonor && honorPerms ? (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                honorCtx.homeLocked && honorCtx.awayLocked
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : honorCtx.phase === "sequential"
                    ? "border-sky-200 bg-sky-50 text-sky-950"
                    : "border-zinc-300 bg-zinc-50 text-zinc-900"
              }`}
              role="status"
            >
              <p className="font-semibold">
                {honorCtx.homeLocked && honorCtx.awayLocked
                  ? t("honorLineup.phaseBothLockedTitle")
                  : honorCtx.phase === "sequential"
                    ? t("honorLineup.phaseSequentialTitle")
                    : t("honorLineup.phaseBlindTitle")}
              </p>
              <p className="mt-1">
                {honorCtx.homeLocked && honorCtx.awayLocked
                  ? t("honorLineup.phaseBothLockedBody")
                  : honorCtx.phase === "sequential"
                    ? honorCtx.awayLocked
                      ? t("honorLineup.phaseSequentialHomeTurn", {
                          awayTeam: match.away_team.name,
                          homeTeam: match.home_team.name,
                        })
                      : t("honorLineup.phaseSequentialAwayTurn", {
                          awayTeam: match.away_team.name,
                        })
                    : t("honorLineup.phaseBlindBody")}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {honorCtx.isHonor && honorPerms ? (
              <>
                <HonorMatchLineupEditor
                  matchId={matchId}
                  side="home"
                  teamId={match.home_team_id}
                  teamName={match.home_team.name}
                  opponentTeamName={match.away_team.name}
                  roster={homeRoster}
                  initialLineup={visibleHomeLineup}
                  canEdit={canEditHome && honorPerms.canEditHome}
                  canLock={honorPerms.canLockHome}
                  canUnlock={honorPerms.canUnlock}
                  canViewSeats={honorPerms.canViewHome}
                  locked={honorCtx.homeLocked}
                  opponentLocked={honorCtx.awayLocked}
                  phase={honorCtx.phase}
                  venueTables={honorCtx.venueTables}
                />
                <HonorMatchLineupEditor
                  matchId={matchId}
                  side="away"
                  teamId={match.away_team_id}
                  teamName={match.away_team.name}
                  opponentTeamName={match.home_team.name}
                  roster={awayRoster}
                  initialLineup={visibleAwayLineup}
                  canEdit={canEditAway && honorPerms.canEditAway}
                  canLock={honorPerms.canLockAway}
                  canUnlock={honorPerms.canUnlock}
                  canViewSeats={honorPerms.canViewAway}
                  locked={honorCtx.awayLocked}
                  opponentLocked={honorCtx.homeLocked}
                  phase={honorCtx.phase}
                  venueTables={honorCtx.venueTables}
                />
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </>
      ) : null}

      {honorScorecard ? (
        <HonorMatchScorecardView scorecard={honorScorecard} />
      ) : (
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
          allowSubmit={canSubmitScoreForMatch && !honorCtx.isHonor}
          isHonor={honorCtx.isHonor}
        />
      )}

      {canAddPenalty ? (
        <MatchPenaltyForm
          homeTeam={{ id: match.home_team_id, name: match.home_team.name }}
          awayTeam={{ id: match.away_team_id, name: match.away_team.name }}
        />
      ) : null}
    </main>
  );
}
