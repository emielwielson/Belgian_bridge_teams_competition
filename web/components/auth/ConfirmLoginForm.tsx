"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";

type Props = {
  tokenHash: string | null;
  type: string;
};

type ConfirmResponse = {
  ok?: boolean;
  redirectTo?: string;
  error?: string;
};

export function ConfirmLoginForm({ tokenHash, type }: Props) {
  const t = useTranslations("auth");
  const translateApiError = useTranslateApiError();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    tokenHash ? null : t("confirmMissingToken"),
  );

  async function handleConfirm() {
    if (!tokenHash) {
      setError(t("confirmMissingToken"));
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token_hash: tokenHash, type }),
    });

    const body = (await res.json()) as ConfirmResponse;

    if (!res.ok) {
      setLoading(false);
      setError(
        body.error ? translateApiError(body.error) : t("confirmFailed"),
      );
      return;
    }

    window.location.assign(body.redirectTo ?? "/");
  }

  return (
    <div className="card flex max-w-sm flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">{t("confirmTitle")}</h1>
      <p className="text-sm text-zinc-600">{t("confirmMessage")}</p>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={loading || !tokenHash}
        onClick={handleConfirm}
        className="btn-primary w-full"
      >
        {loading ? t("confirming") : t("confirmButton")}
      </button>
      <p className="text-center text-sm text-zinc-600">
        <a href="/login" className="underline">
          {t("backToLogin")}
        </a>
      </p>
    </div>
  );
}
