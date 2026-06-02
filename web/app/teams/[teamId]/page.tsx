import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { TeamConventionCardsSection } from "@/components/teams/TeamConventionCardsSection";
import { TeamInfoSection } from "@/components/teams/TeamInfoSection";
import { TeamMatchesList } from "@/components/teams/TeamMatchesList";
import { TeamRosterList } from "@/components/teams/TeamRosterList";
import { canManageTeamConventionCards } from "@/lib/auth/team-access";
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

  const conventionCards = await listConventionCards(supabase, teamId);

  const { team, captain, club, group, division, league, roster, matches } =
    detail;

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href="/standings" className="link-back">
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

      <TeamRosterList roster={roster} captainId={team.captain_id} />

      <TeamConventionCardsSection
        teamId={team.id}
        initialCards={conventionCards}
        canManage={canManageConventionCards}
      />

      <TeamMatchesList teamName={team.name} matches={matches} />
    </main>
  );
}
