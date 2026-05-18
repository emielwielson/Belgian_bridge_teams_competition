import { describe, expect, it } from "vitest";
import { findVpBand, type VpTableRow } from "./vp-lookup";

const demoBands: VpTableRow[] = [
  { imp_min: -999, imp_max: -50, vp_home: 0, vp_away: 24 },
  { imp_min: -49, imp_max: 0, vp_home: 12, vp_away: 12 },
  { imp_min: 1, imp_max: 999, vp_home: 24, vp_away: 0 },
];

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

  it("throws when no band matches", () => {
    expect(() => findVpBand([], 10, 5)).toThrow(/No VP band/);
  });
});
