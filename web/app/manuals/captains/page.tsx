import { redirect } from "next/navigation";
import { ManualSectionPage } from "@/components/manuals/ManualSectionPage";
import { requireManualsUser } from "@/lib/manuals/access";
import { CAPTAIN_GUIDES } from "@/lib/manuals/content";

export const dynamic = "force-dynamic";

export default async function CaptainsManualsPage() {
  const { showCaptainGuides } = await requireManualsUser("/manuals/captains");

  if (!showCaptainGuides) {
    redirect("/manuals");
  }

  return (
    <ManualSectionPage
      titleKey="captain.sectionTitle"
      guides={CAPTAIN_GUIDES}
    />
  );
}
