import { describe, expect, it } from "vitest";
import {
  canAccessArbiterRequestWorkflow,
  type MatchArbiterRequestsState,
} from "./arbiter-request";

describe("canAccessArbiterRequestWorkflow", () => {
  const base: MatchArbiterRequestsState = {
    match_id: "m1",
    board_count: 16,
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
            board: 1,
            description: "test",
            image_path: null,
            status: "open",
            created_at: "2025-01-01T00:00:00Z",
            resolved_at: null,
          },
        ],
      }),
    ).toBe(true);
  });

  it("denies when no submit and no requests", () => {
    expect(canAccessArbiterRequestWorkflow(base)).toBe(false);
  });
});
