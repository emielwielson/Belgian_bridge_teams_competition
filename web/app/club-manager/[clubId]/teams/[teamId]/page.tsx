import Link from "next/link";
import { ClubTeamView } from "@/components/club-manager/ClubTeamView";

type Props = { params: Promise<{ clubId: string; teamId: string }> };

export default async function ClubTeamPage({ params }: Props) {
  const { clubId, teamId } = await params;

  return (
    <main className="page-container flex flex-col gap-6">
      <Link href={`/club-manager/${clubId}`} className="link-back">
        ← Club
      </Link>
      <ClubTeamView clubId={clubId} teamId={teamId} />
    </main>
  );
}
