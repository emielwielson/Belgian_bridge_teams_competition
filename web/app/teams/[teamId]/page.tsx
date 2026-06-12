import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { TeamConventionCardsSection } from "@/components/teams/TeamConventionCardsSection";
import { TeamInfoSection } from "@/components/teams/TeamInfoSection";
import { TeamMatchesList } from "@/components/teams/TeamMatchesList";
import { TeamRosterSection } from "@/components/teams/TeamRosterSection";
import { canManageTeamConventionCards, canManageTeamRoster } from "@/lib/auth/team-access";
import { getUserRoles } from "@/lib/auth/session";
import { isTeamRosterLocked } from "@/lib/competition/league-roster-lock";
import { listConventionCards } from "@/lib/competition/convention-card-queries";
import { loadTeamDetail } from "@/lib/competition/team-queries";
import { createSessionClient } from "@/lib/supabase/server-client";

type Props = { params: Promise<{ teamId: string }> };

export default async function TeamPage({ params }: Props) {
  const { teamId } = await params;
  const t = await getTranslations("team");
  const supabase = await createSessionClient();
  const detail = await loadTeamDetail(supabase, teamId);

  if (!detail) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const canManageConventionCards = user
    ? await canManageTeamConventionCards(supabase, teamId)
    : false;

  const rosterEditable = !(await isTeamRosterLocked(supabase, teamId));
  const canManageRoster = user
    ? await canManageTeamRoster(
        supabase,
        user.id,
        await getUserRoles(supabase, user.id),
        teamId,
        detail.club.id,
      )
    : false;

  const conventionCards = await listConventionCards(supabase, teamId);

  const { team, captain, club, group, division, league, roster, matches } =
    detail;

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href="/" className="link-back">
          {t("backStandings")}
        </Link>
        <nav className="mt-2 flex flex-wrap items-center gap-1 text-sm text-zinc-600">
          <Link href={`/standings/league/${league.id}`} className="hover:text-zinc-900">
            {league.name}
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
        group={group}
        division={division}
        league={league}
      />

      <TeamRosterSection
        teamId={team.id}
        captainId={team.captain_id}
        initialRoster={roster}
        canManageRoster={canManageRoster}
        rosterEditable={rosterEditable}
      />

      <TeamConventionCardsSection
        teamId={team.id}
        initialCards={conventionCards}
        canManage={canManageConventionCards}
      />

      <TeamMatchesList teamName={team.name} matches={matches} />
    </main>
  );
}
