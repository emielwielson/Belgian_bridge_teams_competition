"use client";

import { useEffect, useState } from "react";

type ManualStepProps = {
  stepNumber: number;
  title: string;
  body: string;
  imageSrc?: string;
  /** Used when the locale-specific image 404s (legacy /manuals/*.png). */
  imageFallbackSrc?: string;
  imageAlt?: string;
};

export function ManualStep({
  stepNumber,
  title,
  body,
  imageSrc,
  imageFallbackSrc,
  imageAlt,
}: ManualStepProps) {
  const [src, setSrc] = useState(imageSrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(imageSrc);
    setFailed(false);
  }, [imageSrc]);

  const showImage = Boolean(src) && !failed;

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
      {showImage ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white pl-[52px] shadow-sm">
          <img
            src={src}
            alt={imageAlt ?? title}
            className="w-full object-contain"
            loading="lazy"
            onError={() => {
              if (imageFallbackSrc && src !== imageFallbackSrc) {
                setSrc(imageFallbackSrc);
                return;
              }
              setFailed(true);
            }}
          />
        </div>
      ) : null}
    </li>
  );
}
