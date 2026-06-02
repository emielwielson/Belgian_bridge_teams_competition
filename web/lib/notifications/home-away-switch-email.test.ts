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
  sendHomeAwaySwitchDecisionEmail,
  sendHomeAwaySwitchProposedEmail,
} from "./home-away-switch-email";

function mockServiceClient() {
  const supabase = {
    from: (table: string) => {
      if (table === "teams") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  { captain: { email: "captain-home@example.com" } },
                  { captain: { email: "captain-away@example.com" } },
                ],
                error: null,
              }),
          }),
        };
      }
      if (table === "user_roles") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [{ user_id: "mgr-1" }],
                error: null,
              }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { email: "manager@example.com" } },
          error: null,
        }),
      },
    },
  };
  vi.mocked(createServiceClient).mockReturnValue(supabase as never);
}

describe("home-away-switch-email", () => {
  const env = process.env;
  beforeEach(() => {
    process.env = { ...env, NEXT_PUBLIC_APP_URL: "https://app.example.com" };
    vi.clearAllMocks();
    mockServiceClient();
  });

  afterEach(() => {
    process.env = env;
  });

  it("sends proposed event payload via make webhook", async () => {
    await sendHomeAwaySwitchProposedEmail(
      {
        matchId: "m1",
        round: 4,
        homeTeamName: "Home FC",
        awayTeamName: "Away FC",
        requestingTeamName: "Home FC",
      },
      "home-1",
      "away-1",
      "en",
    );

    expect(sendMakeWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        match_id: "m1",
        match_url: "https://app.example.com/matches/m1",
        login_url: "https://app.example.com/login?next=%2Fmatches%2Fm1",
        cc: expect.arrayContaining(["captain-home@example.com", "manager@example.com"]),
      }),
      expect.objectContaining({ eventType: "home_away_switch_proposed" }),
    );
  });

  it("maps decision action to approved event", async () => {
    await sendHomeAwaySwitchDecisionEmail(
      {
        matchId: "m1",
        round: 4,
        homeTeamName: "Home FC",
        awayTeamName: "Away FC",
        requestingTeamName: "Home FC",
        action: "approve",
      },
      "home-1",
      "away-1",
      "en",
    );

    expect(sendMakeWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ action: "approved" }),
      expect.objectContaining({ eventType: "home_away_switch_approved" }),
    );
  });
});
