"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type SearchableSelectOption = {
  value: string;
  label: string;
  searchText?: string;
};

type Props = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  emptyMessage?: string;
  id?: string;
};

function matchesQuery(option: SearchableSelectOption, query: string): boolean {
  const haystack = (option.searchText ?? option.label).toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  emptyMessage = "No matches",
  id,
}: Props) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(
    () => (query.trim() ? options.filter((o) => matchesQuery(o, query)) : options),
    [options, query],
  );

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openList() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function selectOption(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((i) =>
        filtered.length === 0 ? 0 : Math.min(i + 1, filtered.length - 1),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlightIndex];
      if (option) selectOption(option.value);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className="relative w-full">
      {open ? (
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-autocomplete="list"
          disabled={disabled}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 disabled:opacity-50"
          autoComplete="off"
        />
      ) : (
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded="false"
          aria-controls={listboxId}
          disabled={disabled}
          onClick={openList}
          className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left disabled:opacity-50"
        >
          <span className={selected ? "text-zinc-900" : "text-zinc-500"}>
            {selected?.label ?? placeholder}
          </span>
          <span aria-hidden className="ml-2 text-zinc-400">
            ▾
          </span>
        </button>
      )}

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">{emptyMessage}</li>
          ) : (
            filtered.map((option, index) => {
              const active = index === highlightIndex;
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`cursor-pointer px-3 py-2 text-sm ${
                    active ? "bg-zinc-100 text-zinc-900" : "text-zinc-800"
                  }`}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(option.value);
                  }}
                >
                  {option.label}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
