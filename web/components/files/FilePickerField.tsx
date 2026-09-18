"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";

/** Default accept for arbiter attachment uploads (PDF / images). */
export const FILE_PICKER_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp";

type Props = {
  id: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  hint: string;
  /** File filter for the native picker (e.g. ".pbn" or FILE_PICKER_ACCEPT). */
  accept: string;
  disabled?: boolean;
};

export function FilePickerField({
  id,
  file,
  onFileChange,
  hint,
  accept,
  disabled = false,
}: Props) {
  const t = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);

  function clearFile() {
    onFileChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function openPicker() {
    if (disabled) return;
    inputRef.current?.click();
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-600">{hint}</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="sr-only"
          tabIndex={-1}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className="btn-secondary px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("chooseFile")}
        </button>
        <span
          className={[
            "min-w-0 truncate",
            file ? "font-medium text-zinc-900" : "text-zinc-600",
          ].join(" ")}
          title={file?.name}
        >
          {file ? file.name : t("noFileChosen")}
        </span>
        {file && !disabled ? (
          <button
            type="button"
            onClick={clearFile}
            className="text-sm text-zinc-500 hover:text-zinc-800 hover:underline"
          >
            {t("clear")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
