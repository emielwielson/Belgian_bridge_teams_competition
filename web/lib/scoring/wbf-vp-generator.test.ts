import { describe, expect, it } from "vitest";
import { findVpBand } from "./vp-lookup";
import { generateWbfImpVpTable, getWbfVpBands } from "./wbf-vp-generator";
import { STANDARD_24_BOARD_VP_BANDS } from "./standard-vp-bands";

describe("generateWbfImpVpTable", () => {
  it("16-board draw is 10-10", () => {
    const rows = generateWbfImpVpTable(16);
    expect(rows[0]).toEqual([0, 10, 10]);
  });

  it("20-board blitz at 68 IMP", () => {
    const rows = generateWbfImpVpTable(20);
    expect(rows[rows.length - 1]).toEqual([68, 20, 0]);
  });

  it("32-board blitz at 85 IMP", () => {
    const rows = generateWbfImpVpTable(32);
    expect(rows[rows.length - 1][0]).toBe(85);
    expect(rows[rows.length - 1][1]).toBe(20);
  });
});

describe("getWbfVpBands", () => {
  it("16-board net IMP 10 maps to winner ~12.8 VP", () => {
    const bands = getWbfVpBands(16);
    const result = findVpBand(bands, 20, 10);
    expect(result.vpHome).toBe(12.8);
    expect(result.vpAway).toBe(7.2);
  });

  it("24-board bands match canonical table at draw", () => {
    expect(findVpBand(STANDARD_24_BOARD_VP_BANDS, 0, 0)).toEqual({
      vpHome: 10,
      vpAway: 10,
    });
  });
});
