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
        login_url: "https://app.example.com/login?next=%2Fmatches%2Fm1",
        cc: ["captain-home@example.com", "captain-away@example.com"],
        requesting_captain_name: "Home Captain",
        requesting_captain_email: "captain-home@example.com",
        receiving_captain_name: "Away Captain",
        receiving_captain_email: "captain-away@example.com",
        body_text: expect.stringMatching(
          /Please do not reply to this email[\s\S]*Home Captain/,
        ),
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
        requestingTeamId: "home-1",
        action: "approve",
      },
      "home-1",
      "away-1",
      "en",
    );

    expect(sendMakeWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "approved",
        receiving_captain_name: "Away Captain",
      }),
      expect.objectContaining({ eventType: "home_away_switch_approved" }),
    );
  });
});
