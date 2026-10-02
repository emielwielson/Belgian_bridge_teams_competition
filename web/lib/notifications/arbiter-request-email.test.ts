import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("./resend-email", () => ({
  sendResendEmail: vi.fn().mockResolvedValue({ sent: true }),
}));

import { createServiceClient } from "@/lib/supabase/server-client";
import { sendResendEmail } from "./resend-email";
import {
  sendArbiterRequestAssignedEmail,
  sendArbiterRequestCreatedEmail,
  sendArbiterRequestResolvedEmail,
} from "./arbiter-request-email";

function mockServiceClient() {
  const supabase = {
    from: (table: string) => {
      if (table === "user_roles") {
        return {
          select: () => ({
            eq: (_col: string, role: string) => ({
              in: () =>
                role === "arbiter"
                  ? Promise.resolve({
                      data: [{ user_id: "chief-1" }],
                      error: null,
                    })
                  : Promise.resolve({ data: [], error: null }),
            }),
            in: () =>
              Promise.resolve({
                data: [
                  { user_id: "manager-1", role: "competition_manager" },
                ],
                error: null,
              }),
          }),
        };
      }
      if (table === "competition_manager_scopes") {
        return {
          select: () =>
            Promise.resolve({
              data: [],
              error: null,
            }),
        };
      }
      if (table === "arbiter_competition_scopes") {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({
                  data: [{ user_id: "chief-1" }],
                  error: null,
                }),
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
                    assigned_arbiter_id: "assigned-1",
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
                  data: cols.includes("competition_kind_id")
                    ? {
                        id: "m1",
                        groups: {
                          divisions: {
                            leagues: { competition_kind_id: "kind-wallonia" },
                          },
                        },
                      }
                    : cols.includes("home_team_id")
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
            "chief-1": "chief@example.com",
            "manager-1": "manager@example.com",
            "assigned-1": "assigned@example.com",
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

  it("sends created email to managers and chief only", async () => {
    await sendArbiterRequestCreatedEmail({ matchId: "m1" }, "en");

    expect(sendResendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Arbiter request:"),
        to: expect.arrayContaining([
          "chief@example.com",
          "manager@example.com",
        ]),
        logLabel: "arbiter_request_created",
      }),
    );
    const params = vi.mocked(sendResendEmail).mock.calls[0][0];
    expect(params.to).not.toContain("home-captain@example.com");
    expect(params.to).not.toContain("away-captain@example.com");
    expect(params.to).not.toContain("assigned@example.com");
  });

  it("sends assigned email to the assigned arbiter only", async () => {
    await sendArbiterRequestAssignedEmail(
      { requestId: "req-1", assignedArbiterId: "assigned-1" },
      "en",
    );

    expect(sendResendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["assigned@example.com"],
        logLabel: "arbiter_request_assigned",
      }),
    );
  });

  it("sends resolved email to managers, chief, assigned, and captains", async () => {
    await sendArbiterRequestResolvedEmail({ requestId: "req-1" }, "en");

    expect(sendResendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.arrayContaining([
          "chief@example.com",
          "manager@example.com",
          "assigned@example.com",
          "home-captain@example.com",
          "away-captain@example.com",
        ]),
        logLabel: "arbiter_request_resolved",
      }),
    );
  });
});
