import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("./resend-email", () => ({
  sendResendEmail: vi.fn().mockResolvedValue({ sent: true }),
}));

vi.mock("./match-competition-kind", () => ({
  loadMatchCompetitionKindCode: vi.fn().mockResolvedValue("national"),
}));

import { createServiceClient } from "@/lib/supabase/server-client";
import { sendResendEmail } from "./resend-email";
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

  it("sends proposed email via Resend", async () => {
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

    expect(sendResendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["captain-home@example.com", "captain-away@example.com"],
        text: expect.stringMatching(
          /Please do not reply to this email[\s\S]*Home Captain/,
        ),
        html: expect.any(String),
        subject: expect.any(String),
        competitionKind: "national",
        logLabel: "home_away_switch_proposed",
      }),
    );
  });

  it("maps decision action to approved log label", async () => {
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

    expect(sendResendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        logLabel: "home_away_switch_approved",
        competitionKind: "national",
        text: expect.stringContaining("Away Captain"),
      }),
    );
  });
});
