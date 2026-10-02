import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendResendEmail } from "./resend-email";

describe("sendResendEmail", () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.EMAIL_FROM;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Interclub <noreply@example.com>";
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    process.env.EMAIL_FROM = originalFrom;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("skips when API key or from address is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendResendEmail({
      to: ["a@example.com"],
      subject: "Hi",
      html: "<p>Hi</p>",
    });
    expect(result).toEqual({ sent: false, skipped: true });
  });

  it("returns no_recipients when to is empty", async () => {
    const result = await sendResendEmail({
      to: [],
      subject: "Hi",
      html: "<p>Hi</p>",
    });
    expect(result).toEqual({ sent: false, error: "no_recipients" });
  });

  it("retries until success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("error"),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const promise = sendResendEmail({
      to: ["a@example.com"],
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      baseDelayMs: 10,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
        }),
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body).toEqual({
      from: "Interclub <noreply@example.com>",
      to: ["a@example.com"],
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });
  });
});
