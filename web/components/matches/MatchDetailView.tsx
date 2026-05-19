import Link from "next/link";
import { MatchSecondaryWorkflows } from "@/components/matches/MatchSecondaryWorkflows";
import { PostponeWorkflow } from "@/components/matches/PostponeWorkflow";
import { MatchLineupEditor } from "@/components/player/MatchLineupEditor";
import { MatchScoreForm } from "@/components/player/MatchScoreForm";
import {
  canEditLineupForTeam,
  canViewMatchOps,
  userManagesMatchClub,
  type MatchContext,
} from "@/lib/auth/match-access";
import { COMPETITION_ADMIN_ROLES } from "@/lib/auth/route-auth";
import { hasAnyRole } from "@/lib/auth/roles";
import {
  canAccessPostponementWorkflow,
  getMatchPostponementState,
} from "@/lib/competition/postponement";
import {
  canAccessArbiterRequestWorkflow,
  getMatchArbiterRequestsState,
} from "@/lib/competition/arbiter-request";
import {
  getMatchHomeAwaySwitchState,
  shouldShowHomeAwaySwitchSection,
} from "@/lib/competition/home-away-switch";
import type { MatchPageBackLink } from "@/lib/competition/match-page-context";
import { loadTeamRoster } from "@/lib/competition/player-matches";
import { getMatchLineup, isLineupComplete } from "@/lib/scoring/match-operations";
import { matchStatus } from "@/lib/scoring/match-state";
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

export async function MatchDetailView({
  supabase,
  match,
  matchId,
  backLink,
  userId,
  roles,
}: Props) {
  const canOps = userId
    ? await canViewMatchOps(supabase, matchId)
    : false;

  const lineup = await getMatchLineup(supabase, matchId);
  const [homeRoster, awayRoster] = await Promise.all([
    loadTeamRoster(supabase, match.home_team_id),
    loadTeamRoster(supabase, match.away_team_id),
  ]);

  const isAdmin = userId
    ? hasAnyRole(roles, [...COMPETITION_ADMIN_ROLES])
    : false;
  const managesClub =
    userId && canOps
      ? await userManagesMatchClub(supabase, userId, roles, match)
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
      arbiterRequestsState = await getMatchArbiterRequestsState(
        supabase,
        matchId,
      );
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
    shouldShowHomeAwaySwitchSection(homeAwaySwitchState);
  const showArbiterRequests =
    canOps &&
    arbiterRequestsState != null &&
    canAccessArbiterRequestWorkflow(arbiterRequestsState);

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
      ? managesClub
        ? { href: "/club-manager", label: "← My club" }
        : { href: "/player", label: "← Player dashboard" }
      : null;

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href={backLink.href} className="link-back">
          {backLink.label}
        </Link>
        {opsBackLink ? (
          <p className="mt-2">
            <Link href={opsBackLink.href} className="text-sm text-zinc-600 hover:underline">
              {opsBackLink.label}
            </Link>
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Round {match.round}: {match.home_team.name} vs {match.away_team.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {formatBrussels(match.datetime)}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={
              status === "played"
                ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                : "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700"
            }
          >
            {status === "played" ? "Played" : "Scheduled"}
          </span>
          {match.played_at ? (
            <span className="text-xs text-zinc-500">
              Scored {formatBrussels(match.played_at)}
            </span>
          ) : null}
        </p>
        {!userId ? (
          <p className="mt-3 text-sm text-zinc-600">
            <Link href={`/login?next=/matches/${matchId}`} className="font-medium text-emerald-800 hover:underline">
              Sign in
            </Link>{" "}
            to score this match or manage lineups if you are on one of the teams.
          </p>
        ) : null}
      </header>

      {showPostpone ? (
        <PostponeWorkflow
          matchId={matchId}
          homeTeamName={match.home_team.name}
          awayTeamName={match.away_team.name}
          homeTeamId={match.home_team_id}
          awayTeamId={match.away_team_id}
        />
      ) : null}

      {showArbiterRequests || showHomeAwaySwitch ? (
        <MatchSecondaryWorkflows
          matchId={matchId}
          showArbiter={showArbiterRequests}
          showHomeAwaySwitch={showHomeAwaySwitch}
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
        boardCount={match.board_count}
        initialImpsHome={match.imps_home}
        initialImpsAway={match.imps_away}
        initialVpHome={match.vp_home}
        initialVpAway={match.vp_away}
        playedAt={match.played_at}
        isAdmin={isAdmin}
        lineupsComplete={lineupsComplete}
        allowSubmit={canOps}
      />
    </main>
  );
}
