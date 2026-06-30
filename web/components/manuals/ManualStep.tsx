type ManualStepProps = {
  stepNumber: number;
  title: string;
  body: string;
  imageSrc?: string;
  imageAlt?: string;
};

export function ManualStep({
  stepNumber,
  title,
  body,
  imageSrc,
  imageAlt,
}: ManualStepProps) {
  return (
    <li className="flex flex-col gap-3">
      <div className="flex gap-4">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white"
          aria-hidden
        >
          {stepNumber}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600">{body}</p>
        </div>
      </div>
      {imageSrc ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white pl-[52px] shadow-sm">
          <img
            src={imageSrc}
            alt={imageAlt ?? title}
            className="w-full object-contain"
            loading="lazy"
          />
        </div>
      ) : null}
    </li>
  );
}
