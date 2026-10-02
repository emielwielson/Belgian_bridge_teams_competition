import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEmailFrom, sendResendEmail } from "./resend-email";

describe("getEmailFrom", () => {
  const originals = {
    EMAIL_FROM: process.env.EMAIL_FROM,
    NATIONAL_EMAIL_FROM: process.env.NATIONAL_EMAIL_FROM,
    FLANDERS_EMAIL_FROM: process.env.FLANDERS_EMAIL_FROM,
    WALLONIA_EMAIL_FROM: process.env.WALLONIA_EMAIL_FROM,
    ZWEIFFEL_EMAIL_FROM: process.env.ZWEIFFEL_EMAIL_FROM,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("prefers kind-specific from over EMAIL_FROM", () => {
    process.env.EMAIL_FROM = "Fallback <noreply@example.com>";
    process.env.WALLONIA_EMAIL_FROM = "LBF <noreply@lbf.example.com>";
    expect(getEmailFrom("wallonia")).toBe("LBF <noreply@lbf.example.com>");
  });

  it("falls back to EMAIL_FROM when kind-specific unset", () => {
    process.env.EMAIL_FROM = "Fallback <noreply@example.com>";
    delete process.env.FLANDERS_EMAIL_FROM;
    expect(getEmailFrom("flanders")).toBe("Fallback <noreply@example.com>");
  });

  it("returns undefined when no from is configured", () => {
    delete process.env.EMAIL_FROM;
    delete process.env.NATIONAL_EMAIL_FROM;
    expect(getEmailFrom("national")).toBeUndefined();
    expect(getEmailFrom()).toBeUndefined();
  });
});

describe("sendResendEmail", () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.EMAIL_FROM;
  const originalFlanders = process.env.FLANDERS_EMAIL_FROM;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Interclub <noreply@example.com>";
    delete process.env.FLANDERS_EMAIL_FROM;
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    process.env.EMAIL_FROM = originalFrom;
    if (originalFlanders === undefined) delete process.env.FLANDERS_EMAIL_FROM;
    else process.env.FLANDERS_EMAIL_FROM = originalFlanders;
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

  it("uses competition-kind from address when set", async () => {
    process.env.FLANDERS_EMAIL_FROM = "VBL <noreply@vbl.example.com>";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendResendEmail({
      to: ["a@example.com"],
      subject: "Hi",
      html: "<p>Hi</p>",
      competitionKind: "flanders",
    });

    expect(result).toEqual({ sent: true });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.from).toBe("VBL <noreply@vbl.example.com>");
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
