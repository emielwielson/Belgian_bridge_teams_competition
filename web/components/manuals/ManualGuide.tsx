"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import type { ManualGuideDef } from "@/lib/manuals/content";
import {
  manualImageFallbackSrc,
  manualImageSrc,
} from "@/lib/manuals/content";
import { ManualStep } from "./ManualStep";

type ManualGuideProps = {
  guide: ManualGuideDef;
};

export function ManualGuide({ guide }: ManualGuideProps) {
  const t = useTranslations("manuals");
  const locale = useLocale() as Locale;

  return (
    <section
      id={guide.anchor}
      className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm"
    >
      <header className="border-b border-slate-200 bg-slate-900 px-4 py-4 sm:px-6">
        <h2 className="text-lg font-semibold text-white sm:text-xl">
          {t(`${guide.translationKey}.title`)}
        </h2>
      </header>
      <ol className="flex flex-col gap-8 px-4 py-6 sm:px-6">
        {guide.steps.map((step, index) => (
          <ManualStep
            key={step.id}
            stepNumber={index + 1}
            title={t(`${guide.translationKey}.steps.${step.id}.title`)}
            body={t(`${guide.translationKey}.steps.${step.id}.body`)}
            imageSrc={manualImageSrc(step.image, locale)}
            imageFallbackSrc={manualImageFallbackSrc(step.image)}
            imageAlt={t(`${guide.translationKey}.steps.${step.id}.title`)}
          />
        ))}
      </ol>
    </section>
  );
}
