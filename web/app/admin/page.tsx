import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function AdminPage() {
  const t = await getTranslations("admin");

  return (
    <main className="page-container flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
      <nav className="flex flex-col gap-3">
        <Link href="/admin/competition" className="card hover:border-zinc-400">
          <span className="font-medium">{t("competitionSetup")}</span>
          <p className="mt-1 text-sm font-normal text-zinc-600">
            {t("competitionSetupDescription")}
          </p>
        </Link>
        <Link href="/admin/discipline" className="card hover:border-zinc-400">
          <span className="font-medium">{t("disciplineHub")}</span>
          <p className="mt-1 text-sm font-normal text-zinc-600">
            {t("disciplineHubDescription")}
          </p>
        </Link>
        <Link href="/admin/audit-log" className="card hover:border-zinc-400">
          <span className="font-medium">{t("auditLogHub")}</span>
          <p className="mt-1 text-sm font-normal text-zinc-600">
            {t("auditLogHubDescription")}
          </p>
        </Link>
      </nav>
    </main>
  );
}
