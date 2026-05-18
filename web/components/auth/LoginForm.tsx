"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browser-client";

type Props = {
  nextPath?: string;
};

export function LoginForm({ nextPath }: Props) {
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
    if (nextPath) {
      redirectTo.searchParams.set("next", nextPath);
    }

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
    setMessage("Check your email for the magic link.");
  }

  return (
    <form onSubmit={handleSubmit} className="card flex max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-900">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="you@example.com"
        />
      </label>
      <button
        type="submit"
        disabled={status === "loading" || status === "sent"}
        className="btn-primary w-full"
      >
        {status === "loading" ? "Sending…" : "Send magic link"}
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
