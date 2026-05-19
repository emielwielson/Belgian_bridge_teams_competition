"use client";

import { useRef } from "react";

export const FILE_PICKER_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp";

type Props = {
  id: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  hint: string;
  disabled?: boolean;
};

export function FilePickerField({
  id,
  file,
  onFileChange,
  hint,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function clearFile() {
    onFileChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-600">{hint}</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={FILE_PICKER_ACCEPT}
          disabled={disabled}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        <label
          htmlFor={id}
          className={[
            "btn-secondary cursor-pointer px-3 py-1.5",
            disabled ? "pointer-events-none opacity-50" : "",
          ].join(" ")}
        >
          Choose file
        </label>
        <span className="text-zinc-600">
          {file ? file.name : "No file chosen"}
        </span>
        {file && !disabled ? (
          <button
            type="button"
            onClick={clearFile}
            className="text-sm text-zinc-500 hover:text-zinc-800 hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
