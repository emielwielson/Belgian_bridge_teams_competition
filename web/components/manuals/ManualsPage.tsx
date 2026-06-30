"use client";

import { useTranslations } from "next-intl";
import {
  CAPTAIN_GUIDES,
  PLAYER_GUIDES,
  type ManualGuideDef,
} from "@/lib/manuals/content";
import { ManualGuide } from "./ManualGuide";

type ManualsPageProps = {
  showCaptainGuides: boolean;
};

function TocLink({ guide, label }: { guide: ManualGuideDef; label: string }) {
  return (
    <a
      href={`#${guide.anchor}`}
      className="text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
    >
      {label}
    </a>
  );
}

export function ManualsPage({ showCaptainGuides }: ManualsPageProps) {
  const t = useTranslations("manuals");

  return (
    <main className="page-container flex flex-col gap-10">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          {t("intro")}
        </p>
      </header>

      <nav aria-label={t("toc.label")} className="card flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-900">{t("toc.label")}</p>
        <ul className="flex flex-col gap-1.5">
          {PLAYER_GUIDES.map((guide) => (
            <li key={guide.id}>
              <TocLink
                guide={guide}
                label={t(`${guide.translationKey}.title`)}
              />
            </li>
          ))}
          {showCaptainGuides
            ? CAPTAIN_GUIDES.map((guide) => (
                <li key={guide.id}>
                  <TocLink
                    guide={guide}
                    label={t(`${guide.translationKey}.title`)}
                  />
                </li>
              ))
            : null}
        </ul>
      </nav>

      <div className="flex flex-col gap-12">
        {PLAYER_GUIDES.map((guide) => (
          <ManualGuide key={guide.id} guide={guide} />
        ))}

        {showCaptainGuides ? (
          <>
            <hr className="border-zinc-200" />
            <h2 className="text-lg font-semibold text-zinc-900">
              {t("captain.sectionTitle")}
            </h2>
            {CAPTAIN_GUIDES.map((guide) => (
              <ManualGuide key={guide.id} guide={guide} />
            ))}
          </>
        ) : null}
      </div>
    </main>
  );
}
