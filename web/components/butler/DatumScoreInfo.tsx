"use client";

import { useId, useState } from "react";

export function DatumScoreInfo({
  ariaLabel,
  helpText,
}: {
  ariaLabel: string;
  helpText: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {open ? (
        <p
          id={panelId}
          role="region"
          className="absolute left-0 top-full z-10 mt-1.5 w-64 rounded-md border border-zinc-200 bg-white p-2.5 text-xs font-normal normal-case tracking-normal text-zinc-600 shadow-sm sm:w-72"
        >
          {helpText}
        </p>
      ) : null}
    </span>
  );
}
