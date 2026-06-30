import { redirect } from "next/navigation";
import { ManualsPage } from "@/components/manuals/ManualsPage";
import { isCaptainOfAnyTeam } from "@/lib/auth/team-access";
import { createSessionClient } from "@/lib/supabase/server-client";

export default async function ManualsRoutePage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/manuals");
  }

  const showCaptainGuides = await isCaptainOfAnyTeam(supabase, user.id);

  return <ManualsPage showCaptainGuides={showCaptainGuides} />;
}
