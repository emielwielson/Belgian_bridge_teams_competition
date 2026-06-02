import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ClubOverviewView } from "@/components/club-manager/ClubOverviewView";

type Props = { params: Promise<{ clubId: string }> };

export default async function ClubDetailPage({ params }: Props) {
  const { clubId } = await params;
  const t = await getTranslations("club");

  return (
    <main className="page-container flex flex-col gap-6">
      <Link href="/club-manager" className="link-back">
        {t("detailBack")}
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900">{t("detailTitle")}</h1>
      <ClubOverviewView clubId={clubId} />
    </main>
  );
}
