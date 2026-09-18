import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArbiterInbox } from "@/components/arbiter/ArbiterInbox";
import { ArbiterNav } from "@/components/arbiter/ArbiterNav";
import { getArbiterAccess, resolveArbiterNavAccess } from "@/lib/auth/arbiter-scope";
import { requireRoles } from "@/lib/auth/route-auth";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";

export default async function ArbiterPage() {
  const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
  const arbiterAccess = await getArbiterAccess(supabase, user.id, roles);
  const nav = resolveArbiterNavAccess({ roles, arbiterAccess });

  if (!nav.showInbox) {
    if (nav.showHonor) redirect("/arbiter/honor");
    redirect("/?error=forbidden");
  }

  const t = await getTranslations("arbiter");

  return (
    <main className="page-container">
      <ArbiterNav active="inbox" showInbox={nav.showInbox} showHonor={nav.showHonor} />
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900">{t("pageTitle")}</h1>
      <p className="mt-2 text-sm text-zinc-600">{t("pageDescription")}</p>
      <div className="mt-6">
        <ArbiterInbox />
      </div>
    </main>
  );
}
