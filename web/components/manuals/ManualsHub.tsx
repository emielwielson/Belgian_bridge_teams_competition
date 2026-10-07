"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type Section = {
  href: string;
  titleKey: "player.sectionTitle" | "honor.sectionTitle" | "captain.sectionTitle";
  descriptionKey:
    | "player.sectionIntro"
    | "honor.sectionIntro"
    | "captain.sectionIntro";
};

const SECTIONS: Section[] = [
  {
    href: "/manuals/player",
    titleKey: "player.sectionTitle",
    descriptionKey: "player.sectionIntro",
  },
  {
    href: "/manuals/honor-division",
    titleKey: "honor.sectionTitle",
    descriptionKey: "honor.sectionIntro",
  },
  {
    href: "/manuals/captains",
    titleKey: "captain.sectionTitle",
    descriptionKey: "captain.sectionIntro",
  },
];

type Props = {
  showCaptainGuides: boolean;
  showHonorGuides: boolean;
};

export function ManualsHub({ showCaptainGuides, showHonorGuides }: Props) {
  const t = useTranslations("manuals");

  const visible = SECTIONS.filter((section) => {
    if (section.href === "/manuals/honor-division") return showHonorGuides;
    if (section.href === "/manuals/captains") return showCaptainGuides;
    return true;
  });

  return (
    <main className="page-container flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          {t("intro")}
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {visible.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="block rounded-2xl border border-slate-300 bg-white px-4 py-4 shadow-sm transition-colors hover:border-emerald-500 hover:bg-emerald-50 sm:px-5"
            >
              <p className="text-base font-semibold text-slate-900">
                {t(section.titleKey)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {t(section.descriptionKey)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
