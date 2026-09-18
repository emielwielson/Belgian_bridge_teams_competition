import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArbiterNav } from "@/components/arbiter/ArbiterNav";
import { HonorSeatingOverview } from "@/components/arbiter/HonorSeatingOverview";
import { getArbiterAccess, resolveArbiterNavAccess } from "@/lib/auth/arbiter-scope";
import { requireRoles } from "@/lib/auth/route-auth";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";

export default async function ArbiterHonorPage() {
  const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
  const arbiterAccess = await getArbiterAccess(supabase, user.id, roles);
  const nav = resolveArbiterNavAccess({ roles, arbiterAccess });

  if (!nav.showHonor) {
    if (nav.showInbox) redirect("/arbiter");
    redirect("/?error=forbidden");
  }

  const t = await getTranslations("arbiter.honorSeating");

  return (
    <main className="page-container">
      <ArbiterNav active="honor" showInbox={nav.showInbox} showHonor={nav.showHonor} />
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900">
        {t("pageTitle")}
      </h1>
      <p className="mt-2 text-sm text-zinc-600">{t("pageDescription")}</p>
      <div className="mt-6">
        <HonorSeatingOverview />
      </div>
    </main>
  );
}
