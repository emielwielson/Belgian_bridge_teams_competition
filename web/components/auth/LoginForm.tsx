"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ErrorCodes } from "@/lib/http/error-codes";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";

type Props = {
  nextPath?: string;
};

type LoginResponse = {
  ok?: boolean;
  error?: string;
};

export function LoginForm({ nextPath }: Props) {
  const t = useTranslations("auth");
  const translateApiError = useTranslateApiError();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), next: nextPath ?? "/" }),
    });

    const body = (await res.json()) as LoginResponse;

    if (res.status === 404 && body.error === ErrorCodes.auth.emailNotRegistered) {
      setStatus("error");
      setMessage(t("emailNotRegistered"));
      return;
    }

    if (!res.ok) {
      setStatus("error");
      setMessage(translateApiError(body.error));
      return;
    }

    setStatus("sent");
    setMessage(t("checkEmail"));
  }

  return (
    <form onSubmit={handleSubmit} className="card flex max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-900">
        {t("email")}
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder={t("emailPlaceholder")}
        />
      </label>
      <button
        type="submit"
        disabled={status === "loading" || status === "sent"}
        className="btn-primary w-full"
      >
        {status === "loading" ? t("sending") : t("sendMagicLink")}
      </button>
      {message && (
        <p
          role="status"
          className={`text-sm ${status === "error" ? "text-red-600" : "text-zinc-600"}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
