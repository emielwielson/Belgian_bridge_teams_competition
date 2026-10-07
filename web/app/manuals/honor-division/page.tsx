import { redirect } from "next/navigation";
import { ManualSectionPage } from "@/components/manuals/ManualSectionPage";
import { requireManualsUser } from "@/lib/manuals/access";
import { HONOR_GUIDES } from "@/lib/manuals/content";

export const dynamic = "force-dynamic";

export default async function HonorDivisionManualsPage() {
  const { showHonorGuides } = await requireManualsUser(
    "/manuals/honor-division",
  );

  if (!showHonorGuides) {
    redirect("/manuals");
  }

  return (
    <ManualSectionPage titleKey="honor.sectionTitle" guides={HONOR_GUIDES} />
  );
}
