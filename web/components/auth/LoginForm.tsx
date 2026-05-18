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
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
          placeholder="you@example.com"
        />
      </label>
      <button
        type="submit"
        disabled={status === "loading" || status === "sent"}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
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
