import { describe, expect, it } from "vitest";
import {
  canAccessArbiterRequestWorkflow,
  type MatchArbiterRequestsState,
} from "./arbiter-request";

describe("canAccessArbiterRequestWorkflow", () => {
  const base: MatchArbiterRequestsState = {
    match_id: "m1",
    can_submit: false,
    requests: [],
  };

  it("allows captains who can submit", () => {
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
