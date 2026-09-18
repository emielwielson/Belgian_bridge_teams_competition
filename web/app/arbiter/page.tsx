import { redirect } from "next/navigation";
import { loadArbiterNavAccess } from "@/lib/auth/arbiter-scope";
import { requireRoles } from "@/lib/auth/route-auth";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";

/** Legacy /arbiter → first available league tab (or honor). */
export default async function ArbiterPage() {
  const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
  const nav = await loadArbiterNavAccess(supabase, user.id, roles);

  if (nav.href) redirect(nav.href);
  redirect("/?error=forbidden");
}
