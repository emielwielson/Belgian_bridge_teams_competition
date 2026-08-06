"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ErrorCodes } from "@/lib/http/error-codes";
import { isEmailNotRegisteredError } from "@/lib/auth/login-email";
import { useTranslateApiError } from "@/lib/i18n/translate-api-error";

type Props = {
  nextPath?: string;
};

type LoginResponse = {
  ok?: boolean;
  error?: string;
};

type VerifyOtpResponse = {
  ok?: boolean;
  redirectTo?: string;
  error?: string;
};

export function LoginForm({ nextPath }: Props) {
  const t = useTranslations("auth");
  const translateApiError = useTranslateApiError();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
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

    if (
      (res.status === 404 && body.error === ErrorCodes.auth.emailNotRegistered) ||
      isEmailNotRegisteredError(body.error)
    ) {
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

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), token: otp.trim() }),
    });

    const body = (await res.json()) as VerifyOtpResponse;

    if (!res.ok) {
      setStatus("error");
      setMessage(
        body.error ? translateApiError(body.error) : t("invalidCode"),
      );
      return;
    }

    window.location.assign(body.redirectTo ?? "/");
  }

  if (status === "sent" || showOtp) {
    return (
      <div className="card flex max-w-sm flex-col gap-4">
        {status === "sent" && !showOtp && (
          <>
            <p className="text-sm text-zinc-600" role="status">
              {message}
            </p>
            <p className="text-sm text-zinc-600">{t("emailDelayHint")}</p>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => {
                setShowOtp(true);
                setMessage(null);
                setStatus("idle");
              }}
            >
              {t("useCodeInstead")}
            </button>
          </>
        )}
        {showOtp && (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
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
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-900">
              {t("codeLabel")}
              <input
                type="text"
                name="otp"
                inputMode="numeric"
                pattern="\d{8}"
                maxLength={8}
                required
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                className="input tracking-widest"
                placeholder="12345678"
              />
            </label>
            <button
              type="submit"
              disabled={status === "loading" || otp.length !== 8}
              className="btn-primary w-full"
            >
              {status === "loading" ? t("confirming") : t("verifyCode")}
            </button>
            <button
              type="button"
              className="text-sm text-zinc-600 underline"
              onClick={() => {
                setShowOtp(false);
                setStatus("sent");
                setMessage(t("checkEmail"));
                setOtp("");
              }}
            >
              {t("backToEmailSent")}
            </button>
            {message && (
              <p className="text-sm text-red-600" role="alert">
                {message}
              </p>
            )}
          </form>
        )}
      </div>
    );
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
        disabled={status === "loading"}
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
