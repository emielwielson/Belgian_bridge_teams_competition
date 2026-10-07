import { redirect } from "next/navigation";
import {
  isCaptainOfAnyTeam,
  isPlayerOnHonorTeam,
} from "@/lib/auth/team-access";
import { createSessionClient } from "@/lib/supabase/server-client";

export type ManualsAccess = {
  showCaptainGuides: boolean;
  showHonorGuides: boolean;
};

export async function requireManualsUser(
  nextPath = "/manuals",
): Promise<ManualsAccess> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const [showCaptainGuides, showHonorGuides] = await Promise.all([
    isCaptainOfAnyTeam(supabase, user.id),
    isPlayerOnHonorTeam(supabase, user.id),
  ]);

  return { showCaptainGuides, showHonorGuides };
}
