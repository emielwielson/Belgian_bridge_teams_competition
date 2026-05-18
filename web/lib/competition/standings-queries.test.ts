import { describe, expect, it } from "vitest";
import { bucketStandingsByGroupId } from "./standings-queries";

describe("bucketStandingsByGroupId", () => {
  it("groups standings rows by group_id", () => {
    const rows = [
      {
        group_id: "g1",
        team_id: "t1",
        team_name: "A",
        vp_total: 10,
      },
      {
        group_id: "g2",
        team_id: "t2",
        team_name: "B",
        vp_total: 5,
      },
      {
        group_id: "g1",
        team_id: "t3",
        team_name: "C",
        vp_total: 8,
      },
    ];

    const buckets = bucketStandingsByGroupId(rows);
    expect(buckets.get("g1")).toEqual([
      { team_id: "t1", team_name: "A", vp_total: 10 },
      { team_id: "t3", team_name: "C", vp_total: 8 },
    ]);
    expect(buckets.get("g2")).toEqual([
      { team_id: "t2", team_name: "B", vp_total: 5 },
    ]);
  });
});
