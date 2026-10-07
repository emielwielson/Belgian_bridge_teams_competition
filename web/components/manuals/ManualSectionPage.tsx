"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ManualGuideDef } from "@/lib/manuals/content";
import { ManualGuide } from "./ManualGuide";

type Props = {
  titleKey: "player.sectionTitle" | "honor.sectionTitle" | "captain.sectionTitle";
  guides: ManualGuideDef[];
};

export function ManualSectionPage({ titleKey, guides }: Props) {
  const t = useTranslations("manuals");

  return (
    <main className="page-container flex flex-col gap-8">
      <header>
        <Link href="/manuals" className="link-back">
          {t("backToManuals")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {t(titleKey)}
        </h1>
      </header>

      <div className="flex flex-col gap-6">
        {guides.map((guide) => (
          <ManualGuide key={guide.id} guide={guide} />
        ))}
      </div>
    </main>
  );
}
