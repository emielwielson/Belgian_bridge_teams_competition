import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AdminCompetitionManagersPanel } from "@/components/admin/AdminCompetitionManagersPanel";
import { requireRoles } from "@/lib/auth/route-auth";
import { ROLES } from "@/lib/auth/roles";

export default async function AdminCompetitionManagersPage() {
  await requireRoles([ROLES.SYSTEM_ADMIN]);
  const t = await getTranslations("admin");

  return (
    <main className="page-container flex flex-col gap-6">
      <Link href="/admin" className="text-sm text-zinc-600 hover:text-zinc-900">
        {t("backAdmin")}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          {t("competitionManagersPage.title")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {t("competitionManagersPage.description")}
        </p>
      </div>
      <AdminCompetitionManagersPanel />
    </main>
  );
}
