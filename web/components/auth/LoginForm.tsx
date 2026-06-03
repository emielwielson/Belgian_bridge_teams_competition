"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browser-client";

type Props = {
  nextPath?: string;
};

export function LoginForm({ nextPath }: Props) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const supabase = createBrowserClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    // Always include ?next= so magic-link emails can append &token_hash=…&type=email
    redirectTo.searchParams.set("next", nextPath ?? "/");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo.toString() },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
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
