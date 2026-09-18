import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AdminArbitersPanel } from "@/components/admin/AdminArbitersPanel";
import { requireRoles, COMPETITION_ADMIN_ROLES } from "@/lib/auth/route-auth";

export default async function AdminArbitersPage() {
  await requireRoles([...COMPETITION_ADMIN_ROLES]);
  const t = await getTranslations("admin");

  return (
    <main className="page-container flex flex-col gap-6">
      <Link href="/admin" className="text-sm text-zinc-600 hover:text-zinc-900">
        {t("backAdmin")}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          {t("arbitersPage.title")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {t("arbitersPage.description")}
        </p>
      </div>
      <AdminArbitersPanel />
    </main>
  );
}
