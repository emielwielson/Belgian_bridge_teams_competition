export type SendResendEmailParams = {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  /** Prefix for log lines. */
  logLabel?: string;
  maxAttempts?: number;
  baseDelayMs?: number;
};

export type SendResendEmailResult = {
  sent: boolean;
  skipped?: boolean;
  error?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST to Resend with retries and exponential backoff.
 * Skips (no throw) when RESEND_API_KEY / EMAIL_FROM unset or recipients empty.
 */
export async function sendResendEmail(
  params: SendResendEmailParams,
): Promise<SendResendEmailResult> {
  const to = params.to.map((address) => address.trim()).filter(Boolean);
  if (to.length === 0) {
    return { sent: false, error: "no_recipients" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const logLabel = params.logLabel ?? "resend-email";

  if (!apiKey || !from) {
    console.log(
      `[${logLabel}] Skipping send (RESEND_API_KEY or EMAIL_FROM unset)`,
      { to, subject: params.subject },
    );
    return { sent: false, skipped: true };
  }

  const maxAttempts = params.maxAttempts ?? 3;
  const baseDelayMs = params.baseDelayMs ?? 400;
  const body: Record<string, unknown> = {
    from,
    to,
    subject: params.subject,
    html: params.html,
  };
  if (params.text) body.text = params.text;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (response.ok) return { sent: true };

      const detail = await response.text();
      console.error(
        `[${logLabel}] Resend API error (attempt ${attempt}/${maxAttempts}):`,
        response.status,
        detail,
      );
    } catch (err) {
      console.error(
        `[${logLabel}] Resend request error (attempt ${attempt}/${maxAttempts}):`,
        err,
      );
    }

    if (attempt < maxAttempts) {
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  return { sent: false, error: "resend_error" };
}
