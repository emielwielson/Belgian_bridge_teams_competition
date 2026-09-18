import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArbiterNav } from "@/components/arbiter/ArbiterNav";
import { HonorSeatingOverview } from "@/components/arbiter/HonorSeatingOverview";
import { loadArbiterNavAccess } from "@/lib/auth/arbiter-scope";
import { requireRoles } from "@/lib/auth/route-auth";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";

export default async function ArbiterHonorPage() {
  const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
  const nav = await loadArbiterNavAccess(supabase, user.id, roles);

  if (!nav.showHonor) {
    if (nav.href) redirect(nav.href);
    redirect("/?error=forbidden");
  }

  const t = await getTranslations("arbiter.honorSeating");

  return (
    <main className="page-container">
      <ArbiterNav
        active="honor"
        kinds={nav.kinds}
        showHonor={nav.showHonor}
      />
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
