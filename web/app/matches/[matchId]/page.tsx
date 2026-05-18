import { notFound } from "next/navigation";
import { MatchDetailView } from "@/components/matches/MatchDetailView";
import {
  loadMatchForPage,
  loadMatchStandingsBackLink,
} from "@/lib/competition/match-page-context";
import { getUserRoles } from "@/lib/auth/session";
import { createSessionClient } from "@/lib/supabase/server-client";

type Props = { params: Promise<{ matchId: string }> };

export default async function MatchPage({ params }: Props) {
  const { matchId } = await params;
  const supabase = await createSessionClient();

  const match = await loadMatchForPage(supabase, matchId);
  if (!match) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const roles = user ? await getUserRoles(supabase, user.id) : [];
  const backLink = await loadMatchStandingsBackLink(supabase, match.group_id);

  return (
    <MatchDetailView
      supabase={supabase}
      match={match}
      matchId={matchId}
      backLink={backLink}
      userId={user?.id ?? null}
      roles={roles}
    />
  );
}
