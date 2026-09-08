import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("./make-webhook", () => ({
  sendMakeWebhook: vi.fn().mockResolvedValue(true),
}));

import { createServiceClient } from "@/lib/supabase/server-client";
import { sendMakeWebhook } from "./make-webhook";
import {
  getAppBaseUrl,
  matchPostponementUrl,
  sendPostponementProposedEmail,
} from "./postponement-email";

function mockServiceClient() {
  const supabase = {
    from: (table: string) => {
      if (table === "teams") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  {
                    id: "home-1",
                    captain: {
                      id: "cap-home",
                      name: "Home Captain",
                      email: "captain-home@example.com",
                    },
                  },
                  {
                    id: "away-1",
                    captain: {
                      id: "cap-away",
                      name: "Away Captain",
                      email: "captain-away@example.com",
                    },
                  },
                ],
                error: null,
              }),
          }),
        };
      }
      if (table === "player_auth_links") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  vi.mocked(createServiceClient).mockReturnValue(supabase as never);
}

describe("postponement-email URLs", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env, NEXT_PUBLIC_APP_URL: "https://app.example.com" };
  });

  afterEach(() => {
    process.env = env;
  });

  it("builds match URL for approve link", () => {
    expect(matchPostponementUrl("match-abc")).toBe(
      "https://app.example.com/matches/match-abc",
    );
  });

  it("strips trailing slash from base URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";
    expect(getAppBaseUrl()).toBe("https://app.example.com");
  });
});

describe("postponement-email send", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env, NEXT_PUBLIC_APP_URL: "https://app.example.com" };
    vi.clearAllMocks();
    mockServiceClient();
  });

  afterEach(() => {
    process.env = env;
  });

  it("sends proposed event with captain-only cc", async () => {
    await sendPostponementProposedEmail(
      {
        matchId: "m1",
        round: 4,
        homeTeamName: "Home FC",
        awayTeamName: "Away FC",
        previousDatetime: "2026-01-01T19:00:00Z",
        proposedDatetime: "2026-01-08T19:00:00Z",
        proposingTeamName: "Home FC",
        requestingTeamId: "home-1",
      },
      "home-1",
      "away-1",
      "en",
    );

    expect(sendMakeWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        match_id: "m1",
        match_url: "https://app.example.com/matches/m1",
        cc: ["captain-home@example.com", "captain-away@example.com"],
      }),
      expect.objectContaining({ eventType: "postponement_proposed" }),
    );
  });
});
