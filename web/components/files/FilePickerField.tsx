"use client";

import { useRef, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";

/** Default accept for arbiter attachment uploads (PDF / images). */
export const FILE_PICKER_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp";

type SingleProps = {
  id: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  files?: never;
  onFilesChange?: never;
  multiple?: false;
  maxFiles?: never;
  hint: string;
  /** File filter for the native picker (e.g. ".pbn" or FILE_PICKER_ACCEPT). */
  accept: string;
  disabled?: boolean;
};

type MultiProps = {
  id: string;
  file?: never;
  onFileChange?: never;
  files: File[];
  onFilesChange: (files: File[]) => void;
  multiple: true;
  maxFiles: number;
  hint: string;
  accept: string;
  disabled?: boolean;
};

type Props = SingleProps | MultiProps;

export function FilePickerField(props: Props) {
  const {
    id,
    hint,
    accept,
    disabled = false,
  } = props;
  const t = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const isMultiple = props.multiple === true;

  function clearSingle() {
    if (isMultiple) return;
    props.onFileChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    if (!isMultiple) return;
    const next = props.files.filter((_, i) => i !== index);
    props.onFilesChange(next);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function openPicker() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (isMultiple) {
      const remaining = Math.max(0, props.maxFiles - props.files.length);
      if (remaining === 0) {
        e.target.value = "";
        return;
      }
      const toAdd = selected.slice(0, remaining);
      props.onFilesChange([...props.files, ...toAdd]);
      e.target.value = "";
      return;
    }
    props.onFileChange(selected[0] ?? null);
  }

  const singleFile = !isMultiple ? props.file : null;
  const multiFiles = isMultiple ? props.files : [];
  const atMax = isMultiple && multiFiles.length >= props.maxFiles;

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-600">{hint}</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple={isMultiple}
          disabled={disabled || atMax}
          onChange={handleChange}
          className="sr-only"
          tabIndex={-1}
        />
        <button
          type="button"
          disabled={disabled || atMax}
          onClick={openPicker}
          className="btn-secondary px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMultiple ? t("chooseFiles") : t("chooseFile")}
        </button>
        {!isMultiple ? (
          <>
            <span
              className={[
                "min-w-0 truncate",
                singleFile ? "font-medium text-zinc-900" : "text-zinc-600",
              ].join(" ")}
              title={singleFile?.name}
            >
              {singleFile ? singleFile.name : t("noFileChosen")}
            </span>
            {singleFile && !disabled ? (
              <button
                type="button"
                onClick={clearSingle}
                className="text-sm text-zinc-500 hover:text-zinc-800 hover:underline"
              >
                {t("clear")}
              </button>
            ) : null}
          </>
        ) : multiFiles.length === 0 ? (
          <span className="text-zinc-600">{t("noFileChosen")}</span>
        ) : null}
      </div>
      {isMultiple && multiFiles.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {multiFiles.map((f, index) => (
            <li
              key={`${f.name}-${f.size}-${f.lastModified}-${index}`}
              className="flex flex-wrap items-center gap-2"
            >
              <span
                className="min-w-0 truncate font-medium text-zinc-900"
                title={f.name}
              >
                {f.name}
              </span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="text-sm text-zinc-500 hover:text-zinc-800 hover:underline"
                >
                  {t("clear")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
