import { describe, expect, it } from "vitest";
import { findVpBand } from "./vp-lookup";
import { STANDARD_24_BOARD_VP_BANDS } from "./standard-vp-bands";

const demoBands = STANDARD_24_BOARD_VP_BANDS;

describe("findVpBand", () => {
  it("maps large home loss to 0-24 VP", () => {
    expect(findVpBand(demoBands, 0, 60)).toEqual({ vpHome: 0, vpAway: 24 });
  });

  it("maps draw band at net 0", () => {
    expect(findVpBand(demoBands, 10, 10)).toEqual({ vpHome: 12, vpAway: 12 });
  });

  it("maps home win to 24-0 VP", () => {
    expect(findVpBand(demoBands, 50, 0)).toEqual({ vpHome: 24, vpAway: 0 });
  });

  it("maps net IMP 20 to 24-0 VP", () => {
    expect(findVpBand(demoBands, 30, 10)).toEqual({ vpHome: 24, vpAway: 0 });
  });

  it("throws when no band matches", () => {
    expect(() => findVpBand([], 10, 5)).toThrow(/No VP band/);
  });
});
