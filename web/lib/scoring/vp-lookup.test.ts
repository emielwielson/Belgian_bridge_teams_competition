import { describe, expect, it } from "vitest";
import { findVpBand } from "./vp-lookup";
import { STANDARD_24_BOARD_VP_BANDS } from "./standard-vp-bands";

const bands = STANDARD_24_BOARD_VP_BANDS;

describe("findVpBand (WBF 24-board scale)", () => {
  it("maps exact draw to 10-10 VP", () => {
    expect(findVpBand(bands, 10, 10)).toEqual({ vpHome: 10, vpAway: 10 });
  });

  it("maps 37-47 IMPs to 7.67-12.33 VP", () => {
    expect(findVpBand(bands, 37, 47)).toEqual({
      vpHome: 7.67,
      vpAway: 12.33,
    });
  });

  it("maps net IMP 20 home win", () => {
    expect(findVpBand(bands, 30, 10)).toEqual({
      vpHome: 14.26,
      vpAway: 5.74,
    });
  });

  it("maps large home loss", () => {
    expect(findVpBand(bands, 0, 60)).toEqual({
      vpHome: 0.94,
      vpAway: 19.06,
    });
  });

  it("maps large home win at cap", () => {
    expect(findVpBand(bands, 50, 0)).toEqual({
      vpHome: 18.19,
      vpAway: 1.81,
    });
  });

  it("maps beyond-table home win to 20-0 VP", () => {
    expect(findVpBand(bands, 100, 0)).toEqual({ vpHome: 20, vpAway: 0 });
  });

  it("maps beyond-table home loss to 0-20 VP", () => {
    expect(findVpBand(bands, 0, 100)).toEqual({ vpHome: 0, vpAway: 20 });
  });

  it("throws when no band matches", () => {
    expect(() => findVpBand([], 10, 5)).toThrow(/No VP band/);
  });
});
