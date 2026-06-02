import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ClubTeamView } from "@/components/club-manager/ClubTeamView";

type Props = { params: Promise<{ clubId: string; teamId: string }> };

export default async function ClubTeamPage({ params }: Props) {
  const { clubId, teamId } = await params;
  const t = await getTranslations("club");

  return (
    <main className="page-container flex flex-col gap-6">
      <Link href={`/club-manager/${clubId}`} className="link-back">
        {t("teamBack")}
      </Link>
      <ClubTeamView clubId={clubId} teamId={teamId} />
    </main>
  );
}
