import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  captainEmailsFromContacts,
  loadCaptainContactsForTeams,
  splitRequestingAndReceivingCaptains,
} from "./captain-contacts";

function mockSupabase(options: {
  teams: Array<{
    id: string;
    captain: { id: string; name: string; email: string | null } | null;
  }>;
  authLinks?: Record<string, string | undefined>;
  authEmails?: Record<string, string | undefined>;
}) {
  const getUserById = vi.fn(async (userId: string) => ({
    data: { user: { email: options.authEmails?.[userId] ?? null } },
    error: null,
  }));

  const supabase = {
    from: (table: string) => {
      if (table === "teams") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({ data: options.teams, error: null }),
          }),
        };
      }
      if (table === "player_auth_links") {
        return {
          select: () => ({
            eq: (_col: string, playerId: string) => ({
              limit: () =>
                Promise.resolve({
                  data: options.authLinks?.[playerId]
                    ? [{ auth_user_id: options.authLinks[playerId] }]
                    : [],
                  error: null,
                }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    auth: { admin: { getUserById } },
  };

  return supabase as unknown as SupabaseClient;
}

describe("captain-contacts", () => {
  it("prefers linked auth user email over player email", async () => {
    const supabase = mockSupabase({
      teams: [
        {
          id: "home-1",
          captain: { id: "p1", name: "Jan", email: "player@example.com" },
        },
      ],
      authLinks: { p1: "auth-1" },
      authEmails: { "auth-1": "auth@example.com" },
    });

    const contacts = await loadCaptainContactsForTeams(supabase, ["home-1"]);
    expect(contacts).toEqual([
      { teamId: "home-1", name: "Jan", email: "auth@example.com" },
    ]);
  });

  it("falls back to player email when no auth link", async () => {
    const supabase = mockSupabase({
      teams: [
        {
          id: "away-1",
          captain: { id: "p2", name: "Piet", email: "piet@example.com" },
        },
      ],
    });

    const contacts = await loadCaptainContactsForTeams(supabase, ["away-1"]);
    expect(contacts[0]?.email).toBe("piet@example.com");
  });

  it("splits requesting and receiving captains by team id", () => {
    const contacts = [
      { teamId: "home-1", name: "Jan", email: "jan@example.com" },
      { teamId: "away-1", name: "Piet", email: "piet@example.com" },
    ];

    const { requesting, receiving } = splitRequestingAndReceivingCaptains(
      contacts,
      "home-1",
      "away-1",
      "home-1",
    );

    expect(requesting.name).toBe("Jan");
    expect(receiving.name).toBe("Piet");
  });

  it("deduplicates captain emails", () => {
    const emails = captainEmailsFromContacts([
      { teamId: "a", name: "A", email: "same@example.com" },
      { teamId: "b", name: "B", email: "same@example.com" },
      { teamId: "c", name: "C", email: null },
    ]);
    expect(emails).toEqual(["same@example.com"]);
  });
});
