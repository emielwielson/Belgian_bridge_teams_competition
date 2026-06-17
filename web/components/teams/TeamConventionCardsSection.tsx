"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { toIntlLocale } from "@/i18n/intl-locale";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ConventionCardListItem } from "@/lib/competition/convention-card-queries";
import { formatBrussels } from "@/lib/time/brussels";

const CONVENTION_CARD_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp";

type ConventionCardFileInputProps = {
  id: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  hint: string;
  chooseFileLabel: string;
  noFileChosenLabel: string;
  clearLabel: string;
};

function ConventionCardFileInput({
  id,
  file,
  onFileChange,
  hint,
  chooseFileLabel,
  noFileChosenLabel,
  clearLabel,
}: ConventionCardFileInputProps) {
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
          accept={CONVENTION_CARD_ACCEPT}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        <label htmlFor={id} className="btn-secondary cursor-pointer px-3 py-1.5">
          {chooseFileLabel}
        </label>
        <span className="text-zinc-600">
          {file ? file.name : noFileChosenLabel}
        </span>
        {file ? (
          <button
            type="button"
            onClick={clearFile}
            className="text-sm text-zinc-500 hover:text-zinc-800 hover:underline"
          >
            {clearLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  teamId: string;
  initialCards: ConventionCardListItem[];
  canManage: boolean;
};

export function TeamConventionCardsSection({
  teamId,
  initialCards,
  canManage,
}: Props) {
  const t = useTranslations("team.conventionCards");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const intlLocale = toIntlLocale(locale);
  const [cards, setCards] = useState(initialCards);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileInputKey, setUploadFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const uploadReady = Boolean(uploadName.trim() && uploadFile);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadName.trim() || !uploadFile) {
      setMessage(t("nameAndFileRequired"));
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.set("name", uploadName.trim());
    formData.set("file", uploadFile);
    const res = await fetch(`/api/teams/${teamId}/convention-cards`, {
      method: "POST",
      body: formData,
    });
    setUploading(false);
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error ?? t("uploadFailed"));
      return;
    }
    const body = (await res.json()) as { cards: ConventionCardListItem[] };
    setCards(body.cards);
    setUploadName("");
    setUploadFile(null);
    setUploadFileInputKey((k) => k + 1);
    setMessage(null);
  }

  function startEdit(card: ConventionCardListItem) {
    setEditingId(card.id);
    setEditName(card.name);
    setEditFile(null);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditFile(null);
  }

  async function saveEdit(cardId: string) {
    if (!editName.trim()) {
      setMessage(t("nameRequired"));
      return;
    }
    setSavingId(cardId);
    const formData = new FormData();
    formData.set("name", editName.trim());
    if (editFile) {
      formData.set("file", editFile);
    }
    const res = await fetch(
      `/api/teams/${teamId}/convention-cards/${cardId}`,
      { method: "PATCH", body: formData },
    );
    setSavingId(null);
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error ?? t("updateFailed"));
      return;
    }
    const body = (await res.json()) as { cards: ConventionCardListItem[] };
    setCards(body.cards);
    cancelEdit();
    setMessage(null);
  }

  function requestDelete(cardId: string, cardName: string) {
    setPendingDelete({ id: cardId, name: cardName });
    setMessage(null);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id: cardId } = pendingDelete;
    setDeletingId(cardId);
    const res = await fetch(
      `/api/teams/${teamId}/convention-cards/${cardId}`,
      { method: "DELETE" },
    );
    setDeletingId(null);
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error ?? t("deleteFailed"));
      setPendingDelete(null);
      return;
    }
    const body = (await res.json()) as { cards: ConventionCardListItem[] };
    setCards(body.cards);
    setPendingDelete(null);
    setMessage(null);
  }

  const fileInputLabels = {
    chooseFileLabel: tc("chooseFile"),
    noFileChosenLabel: tc("noFileChosen"),
    clearLabel: tc("clear"),
  };

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">{t("title")}</h2>
      <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>

      {message ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {message}
        </p>
      ) : null}

      {cards.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{t("none")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {cards.map((card) => (
            <li
              key={card.id}
              className="rounded-md border border-zinc-100 px-3 py-3 text-sm"
            >
              {editingId === card.id ? (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-zinc-600">{t("name")}</span>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-lg border border-zinc-300 px-3 py-2"
                    />
                  </label>
                  <ConventionCardFileInput
                    id={`convention-card-edit-file-${card.id}`}
                    file={editFile}
                    onFileChange={setEditFile}
                    hint={t("replaceFile")}
                    {...fileInputLabels}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(card.id)}
                      disabled={savingId === card.id}
                      className="btn-primary px-3 py-1.5 text-sm"
                    >
                      {savingId === card.id ? t("saving") : t("save")}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="btn-secondary px-3 py-1.5 text-sm"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900">{card.name}</p>
                    <p className="mt-1 text-zinc-600">
                      {t("updated", {
                        datetime: formatBrussels(card.updated_at, intlLocale),
                      })}
                    </p>
                    <a
                      href={card.download_url}
                      className="mt-2 inline-block text-emerald-800 hover:underline"
                    >
                      {t("download")}
                    </a>
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(card)}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        {t("edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDelete(card.id, card.name)}
                        className="text-xs text-amber-700 hover:underline"
                      >
                        {t("delete")}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form
          onSubmit={handleUpload}
          className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4"
        >
          <h3 className="text-sm font-medium text-zinc-900">{t("uploadTitle")}</h3>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">{t("name")}</span>
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2"
              placeholder={t("namePlaceholder")}
            />
          </label>
          <ConventionCardFileInput
            key={uploadFileInputKey}
            id="convention-card-upload-file"
            file={uploadFile}
            onFileChange={setUploadFile}
            hint={t("documentHint")}
            {...fileInputLabels}
          />
          <button
            type="submit"
            disabled={uploading || !uploadReady}
            className="btn-primary w-fit disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:opacity-100 hover:disabled:bg-zinc-400"
          >
            {uploading ? t("uploading") : t("uploadButton")}
          </button>
        </form>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={t("delete")}
          message={t("deleteConfirm", { name: pendingDelete.name })}
          confirmLabel={t("delete")}
          cancelLabel={t("cancel")}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
          confirming={deletingId === pendingDelete.id}
        />
      ) : null}
    </section>
  );
}
