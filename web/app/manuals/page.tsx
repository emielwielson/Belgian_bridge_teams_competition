import { ManualsHub } from "@/components/manuals/ManualsHub";
import { requireManualsUser } from "@/lib/manuals/access";

export const dynamic = "force-dynamic";

export default async function ManualsRoutePage() {
  const { showCaptainGuides, showHonorGuides } = await requireManualsUser();

  return (
    <ManualsHub
      showCaptainGuides={showCaptainGuides}
      showHonorGuides={showHonorGuides}
    />
  );
}
