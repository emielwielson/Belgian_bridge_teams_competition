import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PostponeWorkflow } from "@/components/matches/PostponeWorkflow";
import { MatchLineupEditor } from "@/components/player/MatchLineupEditor";
import { MatchScoreForm } from "@/components/player/MatchScoreForm";
import {
  canAccessPostponementWorkflow,
  getMatchPostponementState,
} from "@/lib/competition/postponement";
import {
  canEditLineupForTeam,
  canViewMatchOps,
  loadMatchContext,
  userManagesMatchClub,
} from "@/lib/auth/match-access";
import { loadTeamRoster } from "@/lib/competition/player-matches";
import { getUserRoles } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { COMPETITION_ADMIN_ROLES } from "@/lib/auth/route-auth";
import { getMatchLineup, isLineupComplete } from "@/lib/scoring/match-operations";
import { matchStatus } from "@/lib/scoring/match-state";
import { formatBrussels } from "@/lib/time/brussels";
import { createSessionClient } from "@/lib/supabase/server-client";

type Props = { params: Promise<{ matchId: string }> };

export default async function PlayerMatchPage({ params }: Props) {
  const { matchId } = await params;
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/player/matches/${matchId}`);
  }

  if (!(await canViewMatchOps(supabase, matchId))) {
    notFound();
  }

  const match = await loadMatchContext(supabase, matchId);
  const lineup = await getMatchLineup(supabase, matchId);
  const [homeRoster, awayRoster] = await Promise.all([
    loadTeamRoster(supabase, match.home_team_id),
    loadTeamRoster(supabase, match.away_team_id),
  ]);

  const roles = await getUserRoles(supabase, user.id);
  const isAdmin = hasAnyRole(roles, [...COMPETITION_ADMIN_ROLES]);
  const managesClub = await userManagesMatchClub(
    supabase,
    user.id,
    roles,
    match,
  );
  const [canEditHome, canEditAway] = await Promise.all([
    canEditLineupForTeam(supabase, user.id, roles, match, match.home_team_id),
    canEditLineupForTeam(supabase, user.id, roles, match, match.away_team_id),
  ]);
  const lineupsComplete = await isLineupComplete(supabase, match);
  const status = matchStatus(match.played_at);
  const postponementState = await getMatchPostponementState(supabase, matchId);
  const showPostpone =
    postponementState != null &&
    canAccessPostponementWorkflow(postponementState);

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

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link
          href={managesClub ? "/club-manager" : "/player"}
          className="link-back"
        >
          {managesClub ? "← My club" : "← Player dashboard"}
        </Link>
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
      />
    </main>
  );
}
