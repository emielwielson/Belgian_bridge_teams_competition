import { useTranslations } from "next-intl";
import type { ManualGuideDef } from "@/lib/manuals/content";
import { manualImageSrc } from "@/lib/manuals/content";
import { ManualStep } from "./ManualStep";

type ManualGuideProps = {
  guide: ManualGuideDef;
};

export function ManualGuide({ guide }: ManualGuideProps) {
  const t = useTranslations("manuals");

  return (
    <section id={guide.anchor} className="scroll-mt-20">
      <h2 className="text-xl font-semibold text-zinc-900">
        {t(`${guide.translationKey}.title`)}
      </h2>
      <ol className="mt-6 flex flex-col gap-8">
        {guide.steps.map((step, index) => (
          <ManualStep
            key={step.id}
            stepNumber={index + 1}
            title={t(`${guide.translationKey}.steps.${step.id}.title`)}
            body={t(`${guide.translationKey}.steps.${step.id}.body`)}
            imageSrc={manualImageSrc(step.image)}
            imageAlt={t(`${guide.translationKey}.steps.${step.id}.title`)}
          />
        ))}
      </ol>
    </section>
  );
}
