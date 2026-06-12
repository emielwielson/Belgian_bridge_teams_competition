import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PlayerInfoSection } from "@/components/players/PlayerInfoSection";
import { PlayerTeamAppearancesTable } from "@/components/players/PlayerTeamAppearancesTable";
import { loadPlayerDetail } from "@/lib/competition/player-queries";
import { createSessionClient } from "@/lib/supabase/server-client";

type Props = {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ from?: string }>;
};

function isTeamBackPath(from: string | undefined): from is string {
  return typeof from === "string" && /^\/teams\/[^/]+$/.test(from);
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const { playerId } = await params;
  const { from } = await searchParams;
  const t = await getTranslations("players");
  const supabase = await createSessionClient();
  const detail = await loadPlayerDetail(supabase, playerId);

  if (!detail) {
    notFound();
  }

  const backHref = isTeamBackPath(from) ? from : "/standings";
  const backLabel = isTeamBackPath(from) ? t("backTeam") : t("backStandings");

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <Link href={backHref} className="link-back">
          {backLabel}
        </Link>
      </header>

      <PlayerInfoSection
        player={detail.player}
        assigned_team={detail.assigned_team}
      />

      <PlayerTeamAppearancesTable appearances={detail.appearances} />
    </main>
  );
}
