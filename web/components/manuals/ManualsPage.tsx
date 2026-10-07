"use client";

import { useTranslations } from "next-intl";
import {
  CAPTAIN_GUIDES,
  HONOR_GUIDES,
  PLAYER_GUIDES,
  type ManualGuideDef,
} from "@/lib/manuals/content";
import { ManualGuide } from "./ManualGuide";

type ManualsPageProps = {
  showCaptainGuides: boolean;
  showHonorGuides: boolean;
};

function TocLink({ guide, label }: { guide: ManualGuideDef; label: string }) {
  return (
    <a
      href={`#${guide.anchor}`}
      className="block rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-950"
    >
      {label}
    </a>
  );
}

function GuideSection({
  title,
  guides,
}: {
  title?: string;
  guides: ManualGuideDef[];
}) {
  if (guides.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      {title ? (
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
      ) : null}
      <div className="flex flex-col gap-6">
        {guides.map((guide) => (
          <ManualGuide key={guide.id} guide={guide} />
        ))}
      </div>
    </section>
  );
}

export function ManualsPage({
  showCaptainGuides,
  showHonorGuides,
}: ManualsPageProps) {
  const t = useTranslations("manuals");

  return (
    <main className="page-container flex flex-col gap-10">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          {t("intro")}
        </p>
      </header>

      <nav
        aria-label={t("toc.label")}
        className="rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm sm:p-5"
      >
        <p className="text-sm font-semibold text-slate-900">{t("toc.label")}</p>
        <div className="mt-3 flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {PLAYER_GUIDES.map((guide) => (
              <li key={guide.id}>
                <TocLink
                  guide={guide}
                  label={t(`${guide.translationKey}.title`)}
                />
              </li>
            ))}
          </ul>

          {showHonorGuides ? (
            <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("honor.sectionTitle")}
              </p>
              <ul className="flex flex-col gap-2">
                {HONOR_GUIDES.map((guide) => (
                  <li key={guide.id}>
                    <TocLink
                      guide={guide}
                      label={t(`${guide.translationKey}.title`)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showCaptainGuides ? (
            <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("captain.sectionTitle")}
              </p>
              <ul className="flex flex-col gap-2">
                {CAPTAIN_GUIDES.map((guide) => (
                  <li key={guide.id}>
                    <TocLink
                      guide={guide}
                      label={t(`${guide.translationKey}.title`)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </nav>

      <div className="flex flex-col gap-10">
        <GuideSection guides={PLAYER_GUIDES} />
        {showHonorGuides ? (
          <GuideSection title={t("honor.sectionTitle")} guides={HONOR_GUIDES} />
        ) : null}
        {showCaptainGuides ? (
          <GuideSection
            title={t("captain.sectionTitle")}
            guides={CAPTAIN_GUIDES}
          />
        ) : null}
      </div>
    </main>
  );
}
