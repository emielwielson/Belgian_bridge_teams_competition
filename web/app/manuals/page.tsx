import { redirect } from "next/navigation";
import { ManualsPage } from "@/components/manuals/ManualsPage";
import {
  isCaptainOfAnyTeam,
  isPlayerOnHonorTeam,
} from "@/lib/auth/team-access";
import { createSessionClient } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export default async function ManualsRoutePage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/manuals");
  }

  const [showCaptainGuides, showHonorGuides] = await Promise.all([
    isCaptainOfAnyTeam(supabase, user.id),
    isPlayerOnHonorTeam(supabase, user.id),
  ]);

  return (
    <ManualsPage
      showCaptainGuides={showCaptainGuides}
      showHonorGuides={showHonorGuides}
    />
  );
}
