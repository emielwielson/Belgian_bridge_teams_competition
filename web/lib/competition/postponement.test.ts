import { describe, expect, it } from "vitest";
import {
  canAccessPostponementWorkflow,
  type MatchPostponementState,
} from "./postponement";

function baseState(
  overrides: Partial<MatchPostponementState> = {},
): MatchPostponementState {
  return {
    match_id: "m1",
    datetime: "2025-06-01T14:00:00.000Z",
    played_at: null,
    home_team_id: "h1",
    away_team_id: "a1",
    captain_teams: ["h1"],
    can_propose: false,
    can_approve: false,
    can_reject: false,
    can_cancel: false,
    pending: null,
    ...overrides,
  };
}

describe("canAccessPostponementWorkflow", () => {
  it("allows captains who can propose", () => {
    expect(
      canAccessPostponementWorkflow({ ...baseState(), can_propose: true }),
    ).toBe(true);
  });

  it("allows users who may respond to a pending request", () => {
    expect(
      canAccessPostponementWorkflow({
        ...baseState(),
        can_approve: true,
        can_reject: true,
      }),
    ).toBe(true);
  });

  it("denies regular players when only a pending request exists", () => {
    expect(
      canAccessPostponementWorkflow({
        ...baseState(),
        pending: {
          id: "req-1",
          proposed_datetime: "2025-06-08T14:00:00.000Z",
          proposing_team_id: "h1",
          proposed_by: "user-1",
          created_at: "2025-06-01T10:00:00.000Z",
        },
      }),
    ).toBe(false);
  });
});
