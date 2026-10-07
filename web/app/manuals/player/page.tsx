import { ManualSectionPage } from "@/components/manuals/ManualSectionPage";
import { requireManualsUser } from "@/lib/manuals/access";
import { PLAYER_GUIDES } from "@/lib/manuals/content";

export const dynamic = "force-dynamic";

export default async function PlayerManualsPage() {
  await requireManualsUser("/manuals/player");

  return (
    <ManualSectionPage titleKey="player.sectionTitle" guides={PLAYER_GUIDES} />
  );
}
