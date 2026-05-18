import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/LoginForm";

const signInWithOtp = vi.fn();

vi.mock("@/lib/supabase/browser-client", () => ({
  createBrowserClient: () => ({
    auth: { signInWithOtp },
  }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("submits email for magic link", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
        }),
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent(/check your email/i);
  });

  it("shows error when sign-in fails", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "Rate limited" } });
    const user = userEvent.setup();

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/rate limited/i);
    });
  });
});
