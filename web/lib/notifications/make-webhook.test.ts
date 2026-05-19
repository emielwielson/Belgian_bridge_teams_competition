import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMakeWebhook } from "./make-webhook";

describe("sendMakeWebhook", () => {
  const originalUrl = process.env.MAKE_WEBHOOK_URL;

  beforeEach(() => {
    process.env.MAKE_WEBHOOK_URL = "https://example.com/hook";
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env.MAKE_WEBHOOK_URL = originalUrl;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns false when webhook URL is unset", async () => {
    delete process.env.MAKE_WEBHOOK_URL;
    const ok = await sendMakeWebhook({ foo: "bar" }, { eventType: "test" });
    expect(ok).toBe(false);
  });

  it("retries until success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const promise = sendMakeWebhook(
      { subject: "Hi" },
      { eventType: "test_event", baseDelayMs: 10 },
    );

    await vi.runAllTimersAsync();
    const ok = await promise;

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.type).toBe("test_event");
    expect(body.subject).toBe("Hi");
  });
});
