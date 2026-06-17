import { describe, expect, it } from "vitest";
import {
  canAccessArbiterRequestWorkflow,
  loadMatchArbiterRequestsForUser,
  type MatchArbiterRequestsState,
} from "./arbiter-request";

describe("canAccessArbiterRequestWorkflow", () => {
  const base: MatchArbiterRequestsState = {
    match_id: "m1",
    can_submit: false,
    requests: [],
  };

  it("allows match players who can submit scores", () => {
    expect(canAccessArbiterRequestWorkflow(base, true)).toBe(true);
  });

  it("allows match players who can submit via state flag", () => {
    expect(
      canAccessArbiterRequestWorkflow({ ...base, can_submit: true }),
    ).toBe(true);
  });

  it("allows viewing when requests exist", () => {
    expect(
      canAccessArbiterRequestWorkflow({
        ...base,
        requests: [
          {
            id: "r1",
            description: null,
            image_path: "arbiter/m1/file.pdf",
            status: "open",
            created_at: "2025-01-01T00:00:00Z",
            resolved_at: null,
          },
        ],
      }),
    ).toBe(true);
  });

  it("allows viewing legacy requests with description", () => {
    expect(
      canAccessArbiterRequestWorkflow({
        ...base,
        requests: [
          {
            id: "r2",
            description: "Legacy note",
            image_path: "arbiter/m1/old.pdf",
            status: "resolved",
            created_at: "2025-01-01T00:00:00Z",
            resolved_at: "2025-01-02T00:00:00Z",
          },
        ],
      }),
    ).toBe(true);
  });

  it("denies when no submit and no requests", () => {
    expect(canAccessArbiterRequestWorkflow(base)).toBe(false);
  });
});

describe("loadMatchArbiterRequestsForUser", () => {
  it("returns a submit-capable fallback when view RPC forbids match players", async () => {
    const supabase = {
      rpc: (fn: string) => {
        if (fn === "current_user_can_submit_score") {
          return Promise.resolve({ data: true, error: null });
        }
        if (fn === "get_match_arbiter_requests_state") {
          return Promise.resolve({
            data: null,
            error: new Error("Forbidden"),
          });
        }
        throw new Error(`unexpected ${fn}`);
      },
    } as never;

    const loaded = await loadMatchArbiterRequestsForUser(supabase, "m1");

    expect(loaded.canSubmitScore).toBe(true);
    expect(loaded.state).toEqual({
      match_id: "m1",
      can_submit: true,
      requests: [],
    });
  });

  it("merges score access into loaded state", async () => {
    const supabase = {
      rpc: (fn: string) => {
        if (fn === "current_user_can_submit_score") {
          return Promise.resolve({ data: true, error: null });
        }
        if (fn === "get_match_arbiter_requests_state") {
          return Promise.resolve({
            data: {
              match_id: "m1",
              can_submit: false,
              requests: [],
            },
            error: null,
          });
        }
        throw new Error(`unexpected ${fn}`);
      },
    } as never;

    const loaded = await loadMatchArbiterRequestsForUser(supabase, "m1");

    expect(loaded.state?.can_submit).toBe(true);
  });
});
