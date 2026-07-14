import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/LoginForm";
import { ErrorCodes } from "@/lib/http/error-codes";
import messages from "@/messages/en.json";

function renderLoginForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LoginForm />
    </NextIntlClientProvider>,
  );
}

const fetchMock = vi.fn();

describe("LoginForm", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("submits email for magic link", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    const user = userEvent.setup();

    renderLoginForm();
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", next: "/" }),
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent(/check your email/i);
  });

  it("shows message when email is not registered", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: ErrorCodes.auth.emailNotRegistered }),
    });
    const user = userEvent.setup();

    renderLoginForm();
    await user.type(screen.getByLabelText(/email/i), "unknown@example.com");
    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/not registered/i);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/VBL or LBF/i);
  });

  it("shows friendly message for Supabase signup disabled errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: "Signups not allowed for this instance",
      }),
    });
    const user = userEvent.setup();

    renderLoginForm();
    await user.type(screen.getByLabelText(/email/i), "unknown@example.com");
    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/not registered/i);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/VBL or LBF/i);
  });

  it("shows error when sign-in fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "Rate limited" }),
    });
    const user = userEvent.setup();

    renderLoginForm();
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/rate limited/i);
    });
  });
});
