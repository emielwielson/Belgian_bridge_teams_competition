import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { adminScopePath, SCOPES, REGION_CODES } from "@/lib/competition/scopes";

export default async function CompetitionHubPage() {
  const t = await getTranslations("admin");

  return (
    <main className="page-container flex flex-col gap-6">
      <Link href="/admin" className="link-back">
        {t("backAdmin")}
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900">{t("scopesTitle")}</h1>
      <nav className="flex flex-col gap-3">
        <Link
          href={adminScopePath(SCOPES.NATIONAL)}
          className="card font-medium hover:border-zinc-400"
        >
          {t("national")}
        </Link>
        <Link
          href={adminScopePath(SCOPES.REGIONAL, REGION_CODES.FLANDERS)}
          className="card font-medium hover:border-zinc-400"
        >
          {t("flandersRegional")}
        </Link>
        <Link
          href={adminScopePath(SCOPES.REGIONAL, REGION_CODES.WALLONIA)}
          className="card font-medium hover:border-zinc-400"
        >
          {t("walloniaRegional")}
        </Link>
      </nav>
    </main>
  );
}
