import { notFound } from "next/navigation";
import { MatchDetailView } from "@/components/matches/MatchDetailView";
import {
  loadMatchForPage,
  loadMatchStandingsBackLink,
} from "@/lib/competition/match-page-context";
import { getUserRoles } from "@/lib/auth/session";
import {
  createPublicClient,
  createSessionClient,
} from "@/lib/supabase/server-client";

type Props = { params: Promise<{ matchId: string }> };

export default async function MatchPage({ params }: Props) {
  const { matchId } = await params;
  const publicClient = createPublicClient();
  const match = await loadMatchForPage(publicClient, matchId);
  if (!match) {
    notFound();
  }

  const sessionSupabase = await createSessionClient();
  const [{ data: auth }, backLink] = await Promise.all([
    sessionSupabase.auth.getUser(),
    loadMatchStandingsBackLink(publicClient, match.group_id),
  ]);
  const user = auth.user;
  const roles = user ? await getUserRoles(sessionSupabase, user.id) : [];

  return (
    <MatchDetailView
      supabase={sessionSupabase}
      match={match}
      matchId={matchId}
      backLink={backLink}
      userId={user?.id ?? null}
      roles={roles}
    />
  );
}
