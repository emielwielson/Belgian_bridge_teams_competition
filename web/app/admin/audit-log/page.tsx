import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getManagedAdminHubLinks } from "@/lib/auth/admin-hub-access";
import { adminAuditLogPath } from "@/lib/competition/scopes";

export default async function AuditLogHubPage() {
  const t = await getTranslations("admin");
  const links = await getManagedAdminHubLinks();

  return (
    <main className="page-container flex flex-col gap-6">
      <Link href="/admin" className="link-back">
        {t("backAdmin")}
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900">
        {t("auditLogScopesTitle")}
      </h1>
      <nav className="flex flex-col gap-3">
        {links.map((link) => (
          <Link
            key={link.kind}
            href={adminAuditLogPath(link.scope, link.regionCode)}
            className="card font-medium hover:border-zinc-400"
          >
            {t(link.labelKey)}
          </Link>
        ))}
      </nav>
    </main>
  );
}
