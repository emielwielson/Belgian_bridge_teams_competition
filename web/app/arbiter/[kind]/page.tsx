import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArbiterInbox } from "@/components/arbiter/ArbiterInbox";
import { ArbiterNav } from "@/components/arbiter/ArbiterNav";
import {
  isCompetitionKindCode,
  loadArbiterNavAccess,
} from "@/lib/auth/arbiter-scope";
import { requireRoles } from "@/lib/auth/route-auth";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";

type Props = {
  params: Promise<{ kind: string }>;
};

export default async function ArbiterKindInboxPage({ params }: Props) {
  const { kind: kindParam } = await params;
  if (!isCompetitionKindCode(kindParam)) notFound();

  const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
  const nav = await loadArbiterNavAccess(supabase, user.id, roles);

  if (!nav.kinds.includes(kindParam)) {
    if (nav.href) redirect(nav.href);
    redirect("/?error=forbidden");
  }

  const t = await getTranslations("arbiter");
  const tNav = await getTranslations("arbiter.nav");
  const kindTitle =
    kindParam === "national"
      ? tNav("national")
      : kindParam === "flanders"
        ? tNav("flanders")
        : tNav("wallonia");

  return (
    <main className="page-container">
      <ArbiterNav
        active={kindParam}
        kinds={nav.kinds}
        showHonor={nav.showHonor}
      />
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900">
        {t("pageTitle")} — {kindTitle}
      </h1>
      <p className="mt-2 text-sm text-zinc-600">{t("pageDescription")}</p>
      <div className="mt-6">
        <ArbiterInbox kind={kindParam} />
      </div>
    </main>
  );
}
