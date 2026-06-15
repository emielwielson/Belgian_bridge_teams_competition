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
  sendArbiterRequestCreatedEmail,
  sendArbiterRequestResolvedEmail,
} from "./arbiter-request-email";

function mockServiceClient() {
  const supabase = {
    from: (table: string) => {
      if (table === "user_roles") {
        return {
          select: () => ({
            eq: (_col: string, role: string) =>
              role === "arbiter"
                ? Promise.resolve({
                    data: [{ user_id: "arbiter-1" }],
                    error: null,
                  })
                : Promise.resolve({ data: [], error: null }),
            in: () =>
              Promise.resolve({
                data: [{ user_id: "manager-1" }],
                error: null,
              }),
          }),
        };
      }
      if (table === "arbiter_requests") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    match_id: "m1",
                    description: null,
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "matches") {
        return {
          select: (cols: string) => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: cols.includes("home_team_id")
                    ? {
                        home_team_id: "home-1",
                        away_team_id: "away-1",
                      }
                    : {
                        round: 5,
                        home_team: { name: "Home FC" },
                        away_team: { name: "Away FC" },
                      },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "teams") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  {
                    captain_id: "cap-1",
                    captain: { id: "cap-1", email: null },
                  },
                  {
                    captain_id: "cap-2",
                    captain: { id: "cap-2", email: null },
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
            eq: (_col: string, playerId: string) => ({
              limit: () =>
                Promise.resolve({
                  data:
                    playerId === "cap-1"
                      ? [{ auth_user_id: "captain-user-1" }]
                      : playerId === "cap-2"
                        ? [{ auth_user_id: "captain-user-2" }]
                        : [],
                  error: null,
                }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    auth: {
      admin: {
        getUserById: vi.fn().mockImplementation((userId: string) => {
          const emails: Record<string, string> = {
            "arbiter-1": "arbiter@example.com",
            "manager-1": "manager@example.com",
            "captain-user-1": "home-captain@example.com",
            "captain-user-2": "away-captain@example.com",
          };
          const email = emails[userId];
          return Promise.resolve({
            data: email ? { user: { email } } : { user: null },
            error: null,
          });
        }),
      },
    },
  };
  vi.mocked(createServiceClient).mockReturnValue(supabase as never);
}

describe("arbiter-request-email", () => {
  const env = process.env;
  beforeEach(() => {
    process.env = { ...env, NEXT_PUBLIC_APP_URL: "https://app.example.com" };
    vi.clearAllMocks();
    mockServiceClient();
  });

  afterEach(() => {
    process.env = env;
  });

  it("sends created event to arbiters, captains, and competition managers", async () => {
    await sendArbiterRequestCreatedEmail({ matchId: "m1" }, "en");

    expect(sendMakeWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        match_id: "m1",
        match_url: "https://app.example.com/matches/m1",
        login_url: "https://app.example.com/login?next=%2Fmatches%2Fm1",
        subject: expect.stringContaining("Arbiter request:"),
        cc: expect.arrayContaining([
          "arbiter@example.com",
          "manager@example.com",
          "home-captain@example.com",
          "away-captain@example.com",
        ]),
      }),
      expect.objectContaining({ eventType: "arbiter_request_created" }),
    );
    const payload = vi.mocked(sendMakeWebhook).mock.calls[0][0];
    expect(payload.board).toBeUndefined();
    expect(payload.description).toBeUndefined();
  });

  it("sends resolved event to arbiters, captains, and competition managers", async () => {
    await sendArbiterRequestResolvedEmail({ requestId: "req-1" }, "en");

    expect(sendMakeWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-1",
        match_id: "m1",
        match_url: "https://app.example.com/matches/m1",
        cc: expect.arrayContaining([
          "arbiter@example.com",
          "manager@example.com",
          "home-captain@example.com",
          "away-captain@example.com",
        ]),
      }),
      expect.objectContaining({ eventType: "arbiter_request_resolved" }),
    );
  });
});
