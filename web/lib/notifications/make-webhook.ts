export const MAKE_WEBHOOK_EVENT_TYPES = [
  "arbiter_request_created",
  "arbiter_request_resolved",
  "home_away_switch_proposed",
  "home_away_switch_approved",
  "home_away_switch_rejected",
  "home_away_switch_cancelled",
  "postponement_proposed",
  "postponement_approved",
  "postponement_rejected",
  "postponement_cancelled",
] as const;

export type MakeWebhookEventType = (typeof MAKE_WEBHOOK_EVENT_TYPES)[number];

export type MakeWebhookPayload = Record<string, unknown>;

export type MakeRequestLifecyclePayload = {
  subject: string;
  body_text: string;
  body_html: string;
  cc: string[];
  match_id: string;
  match_url: string;
  login_url: string;
} & MakeWebhookPayload;

export type SendMakeWebhookOptions = {
  eventType: MakeWebhookEventType;
  maxAttempts?: number;
  baseDelayMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST to Make.com with retries and exponential backoff.
 * Returns false when webhook URL is unset or all attempts failed.
 */
export async function sendMakeWebhook(
  payload: MakeWebhookPayload,
  options: SendMakeWebhookOptions,
): Promise<boolean> {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const body = JSON.stringify({
    ...payload,
    type: options.eventType,
    notified_at: new Date().toISOString(),
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) return true;
      console.error(
        `Make webhook ${options.eventType} failed (attempt ${attempt}/${maxAttempts}): HTTP ${res.status}`,
      );
    } catch (err) {
      console.error(
        `Make webhook ${options.eventType} error (attempt ${attempt}/${maxAttempts}):`,
        err,
      );
    }

    if (attempt < maxAttempts) {
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  return false;
}
