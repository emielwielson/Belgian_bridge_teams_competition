import { describe, expect, it } from "vitest";
import { formatClubAddress } from "./club-address";

describe("formatClubAddress", () => {
  it("joins address, postal code, and location", () => {
    expect(
      formatClubAddress({
        address: "Veldstraat 3",
        postal_code: "9000",
        location: "Gent",
      }),
    ).toBe("Veldstraat 3 - 9000 - Gent");
  });

  it("omits empty parts", () => {
    expect(
      formatClubAddress({
        address: "  Main street  ",
        postal_code: "   ",
        location: "Brussels",
      }),
    ).toBe("Main street - Brussels");
  });

  it("returns null when all parts are empty", () => {
    expect(formatClubAddress({ address: "  ", postal_code: null })).toBeNull();
    expect(formatClubAddress(null)).toBeNull();
  });
});
