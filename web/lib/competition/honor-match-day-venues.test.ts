import { describe, expect, it, vi } from "vitest";
import {
  honorVenuesComplete,
  loadHonorMatchVenue,
  normalizeHonorVenueInputs,
} from "./honor-match-day-venues";

describe("honor-match-day-venues", () => {
  it("normalizes seven venue strings", () => {
    const input = [
      "  Hall A  ",
      "",
      "Hall C",
      "  ",
      "Hall E",
      "Hall F",
      "Hall G",
    ];
    expect(normalizeHonorVenueInputs(input)).toEqual([
      "Hall A",
      "",
      "Hall C",
      "",
      "Hall E",
      "Hall F",
      "Hall G",
    ]);
  });

  it("rejects wrong venue array shape", () => {
    expect(normalizeHonorVenueInputs(["a"])).toBeNull();
    expect(normalizeHonorVenueInputs(null)).toBeNull();
    expect(normalizeHonorVenueInputs([1, 2, 3, 4, 5, 6, 7])).toBeNull();
  });

  it("reports completeness only when all seven are set", () => {
    const incomplete = Array.from({ length: 7 }, (_, i) => ({
      matchDayIndex: i + 1,
      location: i === 0 ? "A" : null,
    }));
    expect(honorVenuesComplete(incomplete)).toBe(false);

    const complete = Array.from({ length: 7 }, (_, i) => ({
      matchDayIndex: i + 1,
      location: `Venue ${i + 1}`,
    }));
    expect(honorVenuesComplete(complete)).toBe(true);
  });

  it("resolves venue for rounds on match day 3", async () => {
    const from = vi.fn((table: string) => {
      if (table === "groups") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { division_id: "div-honor" },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "division_match_day_venues") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { location: "  Day 3 hall  " },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const supabase = { from } as never;
    await expect(
      loadHonorMatchVenue(supabase, { group_id: "g1", round: 7 }),
    ).resolves.toBe("Day 3 hall");
    await expect(
      loadHonorMatchVenue(supabase, { group_id: "g1", round: 9 }),
    ).resolves.toBe("Day 3 hall");
  });

  it("returns null when honor day venue is unset", async () => {
    const from = vi.fn((table: string) => {
      if (table === "groups") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { division_id: "div-honor" },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "division_match_day_venues") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(
      loadHonorMatchVenue({ from } as never, { group_id: "g1", round: 1 }),
    ).resolves.toBeNull();
  });
});
