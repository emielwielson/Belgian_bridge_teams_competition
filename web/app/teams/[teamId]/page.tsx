import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { TeamConventionCardsSection } from "@/components/teams/TeamConventionCardsSection";
import { TeamDisciplineSection } from "@/components/teams/TeamDisciplineSection";
import { TeamInfoSection } from "@/components/teams/TeamInfoSection";
import { TeamMatchesList } from "@/components/teams/TeamMatchesList";
import { TeamNextMatchLink } from "@/components/teams/TeamNextMatchLink";
import { TeamRosterSection } from "@/components/teams/TeamRosterSection";
import { canDisciplineTeam } from "@/lib/auth/match-access";
import {
  ARBITER_ACCESS_ROLES,
  COMPETITION_ADMIN_ROLES,
  hasAnyRole,
} from "@/lib/auth/roles";
import { canManageTeamConventionCards, canManageTeamRoster } from "@/lib/auth/team-access";
import { getUserRoles } from "@/lib/auth/session";
import { listConventionCards } from "@/lib/competition/convention-card-queries";
import { loadNextUnplayedMatchForTeam } from "@/lib/competition/player-matches";
import { loadTeamRosterState } from "@/lib/competition/team-roster";
import { loadTeamDetail } from "@/lib/competition/team-queries";
import { translateLeagueName } from "@/lib/i18n/labels";
import { createSessionClient } from "@/lib/supabase/server-client";

type Props = { params: Promise<{ teamId: string }> };

export default async function TeamPage({ params }: Props) {
  const { teamId } = await params;
  const [t, tRegions] = await Promise.all([
    getTranslations("team"),
    getTranslations("regions"),
  ]);
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const detail = await loadTeamDetail(supabase, teamId, {
    includeCaptainContacts: Boolean(user),
  });

  if (!detail) {
    notFound();
  }

  const roles = user ? await getUserRoles(supabase, user.id) : [];

  const canManageConventionCards = user
    ? await canManageTeamConventionCards(supabase, teamId)
    : false;

  const canLinkToPlayers = hasAnyRole(roles, [...COMPETITION_ADMIN_ROLES]);

  const canManageRoster = user
    ? await canManageTeamRoster(
        supabase,
        user.id,
        roles,
        teamId,
        detail.club.id,
      )
    : false;

  const canManageLocation = canManageRoster;

  const canManageDiscipline =
    user && hasAnyRole(roles, [...ARBITER_ACCESS_ROLES])
      ? await canDisciplineTeam(supabase, roles, teamId)
      : false;

  const [conventionCards, rosterState, nextMatch] = await Promise.all([
    listConventionCards(supabase, teamId),
    canManageRoster
      ? loadTeamRosterState(supabase, teamId, detail.club.id)
      : Promise.resolve(null),
    loadNextUnplayedMatchForTeam(supabase, teamId),
  ]);

  const { team, captain, club, group, league, roster, matches, clubLocation, hasCentralizedVenue } =
    detail;
  const leagueName = translateLeagueName(league.name, tRegions);

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href="/" className="link-back">
          {t("backStandings")}
        </Link>
        <nav className="mt-2 flex flex-wrap items-center gap-1 text-sm text-zinc-600">
          <Link href={`/standings/league/${league.id}`} className="hover:text-zinc-900">
            {leagueName}
          </Link>
          <span aria-hidden>·</span>
          <Link
            href={`/standings/group/${group.id}`}
            className="hover:text-zinc-900"
          >
            {group.name}
          </Link>
        </nav>
      </header>

      <TeamInfoSection
        team={team}
        captain={captain}
        club={club}
        clubLocation={clubLocation}
        hasCentralizedVenue={hasCentralizedVenue}
        canLinkToPlayers={canLinkToPlayers}
        showCaptainContacts={Boolean(user)}
        canManageLocation={canManageLocation}
        nextMatchLink={
          nextMatch ? <TeamNextMatchLink match={nextMatch} /> : null
        }
      />

      <TeamRosterSection
        teamId={team.id}
        captainId={team.captain_id}
        initialRoster={roster}
        substitutes={detail.substitutes}
        initialAvailablePlayers={rosterState?.available_players}
        canManageRoster={canManageRoster}
        canLinkToPlayers={canLinkToPlayers}
      />

      <TeamConventionCardsSection
        teamId={team.id}
        initialCards={conventionCards}
        canManage={canManageConventionCards}
      />

      {canManageDiscipline ? <TeamDisciplineSection teamId={team.id} /> : null}

      <TeamMatchesList teamName={team.name} matches={matches} />
    </main>
  );
}
