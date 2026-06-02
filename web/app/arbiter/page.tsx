import { getTranslations } from "next-intl/server";
import { ArbiterInbox } from "@/components/arbiter/ArbiterInbox";

export default async function ArbiterPage() {
  const t = await getTranslations("arbiter");

  return (
    <main className="page-container">
      <h1 className="text-2xl font-semibold text-zinc-900">{t("pageTitle")}</h1>
      <p className="mt-2 text-sm text-zinc-600">{t("pageDescription")}</p>
      <div className="mt-6">
        <ArbiterInbox />
      </div>
    </main>
  );
}
