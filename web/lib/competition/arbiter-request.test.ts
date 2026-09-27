import { describe, expect, it, vi } from "vitest";
import {
  canAccessArbiterRequestWorkflow,
  cancelArbiterRequest,
  loadMatchArbiterRequestsForUser,
  normalizeArbiterRequestImagePaths,
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
            attachments: [
              {
                id: "a1",
                storage_path: "arbiter/m1/file.pdf",
                sort_order: 0,
              },
            ],
            status: "open",
            created_at: "2025-01-01T00:00:00Z",
            resolved_at: null,
            can_cancel: false,
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
            attachments: [
              {
                id: "a2",
                storage_path: "arbiter/m1/old.pdf",
                sort_order: 0,
              },
            ],
            status: "resolved",
            created_at: "2025-01-01T00:00:00Z",
            resolved_at: "2025-01-02T00:00:00Z",
            can_cancel: false,
          },
        ],
      }),
    ).toBe(true);
  });

  it("denies when no submit and no requests", () => {
    expect(canAccessArbiterRequestWorkflow(base)).toBe(false);
  });
});

describe("normalizeArbiterRequestImagePaths", () => {
  it("accepts legacy single image_path", () => {
    expect(
      normalizeArbiterRequestImagePaths({
        image_path: "arbiter/m1/a.pdf",
      }),
    ).toEqual(["arbiter/m1/a.pdf"]);
  });

  it("accepts image_paths array and dedupes", () => {
    expect(
      normalizeArbiterRequestImagePaths({
        image_paths: [
          "arbiter/m1/a.pdf",
          "arbiter/m1/b.pdf",
          "arbiter/m1/a.pdf",
        ],
      }),
    ).toEqual(["arbiter/m1/a.pdf", "arbiter/m1/b.pdf"]);
  });

  it("rejects empty", () => {
    expect(normalizeArbiterRequestImagePaths({})).toEqual({
      error: "required",
    });
  });

  it("rejects more than 5", () => {
    expect(
      normalizeArbiterRequestImagePaths({
        image_paths: [
          "a.pdf",
          "b.pdf",
          "c.pdf",
          "d.pdf",
          "e.pdf",
          "f.pdf",
        ],
      }),
    ).toEqual({ error: "too_many" });
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

  it("parses can_cancel on requests", async () => {
    const supabase = {
      rpc: (fn: string) => {
        if (fn === "current_user_can_submit_score") {
          return Promise.resolve({ data: false, error: null });
        }
        if (fn === "get_match_arbiter_requests_state") {
          return Promise.resolve({
            data: {
              match_id: "m1",
              can_submit: false,
              requests: [
                {
                  id: "r1",
                  description: null,
                  image_path: "arbiter/m1/a.pdf",
                  attachments: [
                    {
                      id: "a1",
                      storage_path: "arbiter/m1/a.pdf",
                      sort_order: 0,
                    },
                  ],
                  status: "open",
                  created_at: "2025-01-01T00:00:00Z",
                  resolved_at: null,
                  can_cancel: true,
                },
              ],
            },
            error: null,
          });
        }
        throw new Error(`unexpected ${fn}`);
      },
    } as never;

    const loaded = await loadMatchArbiterRequestsForUser(supabase, "m1");
    expect(loaded.state?.requests[0]?.can_cancel).toBe(true);
  });
});

describe("cancelArbiterRequest", () => {
  it("calls arbiter_request_cancel RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await cancelArbiterRequest({ rpc } as never, "req-1");
    expect(rpc).toHaveBeenCalledWith("arbiter_request_cancel", {
      p_request_id: "req-1",
    });
  });
});
