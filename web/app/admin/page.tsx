import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function AdminPage() {
  const t = await getTranslations("admin");

  return (
    <main className="page-container flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
      <nav className="flex flex-col gap-3">
        <Link href="/admin/competition" className="card font-medium hover:border-zinc-400">
          {t("competitionSetup")}
        </Link>
      </nav>
    </main>
  );
}
