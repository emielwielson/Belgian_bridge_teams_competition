import { getTranslations } from "next-intl/server";
import { ArbiterNav } from "@/components/arbiter/ArbiterNav";
import { HonorSeatingOverview } from "@/components/arbiter/HonorSeatingOverview";

export default async function ArbiterHonorPage() {
  const t = await getTranslations("arbiter.honorSeating");

  return (
    <main className="page-container">
      <ArbiterNav active="honor" />
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
