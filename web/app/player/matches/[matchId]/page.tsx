import { redirect } from "next/navigation";

type Props = { params: Promise<{ matchId: string }> };

/** Legacy URL — match detail is public at /matches/[matchId]. */
export default async function PlayerMatchPage({ params }: Props) {
  const { matchId } = await params;
  redirect(`/matches/${matchId}`);
}
