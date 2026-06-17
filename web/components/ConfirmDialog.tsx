"use client";

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirming = false,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={confirming ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg"
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 id="confirm-dialog-title" className="text-sm font-semibold text-zinc-900">
          {title}
        </h4>
        <p id="confirm-dialog-message" className="mt-2 text-sm text-zinc-600">
          {message}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
