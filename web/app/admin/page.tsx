import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAuth } from "@/lib/auth/route-auth";
import { ROLES } from "@/lib/auth/roles";

export default async function AdminPage() {
  const { roles } = await requireAuth();
  const t = await getTranslations("admin");
  const isSystemAdmin = roles.includes(ROLES.SYSTEM_ADMIN);

  return (
    <main className="page-container flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
      <nav className="flex flex-col gap-3">
        <Link href="/admin/competition" className="card-interactive">
          <span className="font-medium">{t("competitionSetup")}</span>
          <p className="mt-1 text-sm font-normal text-zinc-600">
            {t("competitionSetupDescription")}
          </p>
        </Link>
        <Link href="/admin/locations" className="card-interactive">
          <span className="font-medium">{t("clubLocationsHub")}</span>
          <p className="mt-1 text-sm font-normal text-zinc-600">
            {t("clubLocationsHubDescription")}
          </p>
        </Link>
        <Link href="/admin/discipline" className="card-interactive">
          <span className="font-medium">{t("disciplineHub")}</span>
          <p className="mt-1 text-sm font-normal text-zinc-600">
            {t("disciplineHubDescription")}
          </p>
        </Link>
        <Link href="/admin/audit-log" className="card-interactive">
          <span className="font-medium">{t("auditLogHub")}</span>
          <p className="mt-1 text-sm font-normal text-zinc-600">
            {t("auditLogHubDescription")}
          </p>
        </Link>
        <Link href="/admin/team-captains" className="card-interactive">
          <span className="font-medium">{t("teamCaptainsHub")}</span>
          <p className="mt-1 text-sm font-normal text-zinc-600">
            {t("teamCaptainsHubDescription")}
          </p>
        </Link>
        <Link href="/admin/arbiters" className="card-interactive">
          <span className="font-medium">{t("arbitersHub")}</span>
          <p className="mt-1 text-sm font-normal text-zinc-600">
            {t("arbitersHubDescription")}
          </p>
        </Link>
        {isSystemAdmin ? (
          <Link
            href="/admin/competition-managers"
            className="card-interactive"
          >
            <span className="font-medium">{t("competitionManagersHub")}</span>
            <p className="mt-1 text-sm font-normal text-zinc-600">
              {t("competitionManagersHubDescription")}
            </p>
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
