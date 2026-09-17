import { describe, expect, it } from "vitest";
import { computeNsDatum, roundUpToNearest, trimCount } from "@/lib/butler/datum";

describe("trimCount", () => {
  it("returns null for N < 3", () => {
    expect(trimCount(0)).toBeNull();
    expect(trimCount(1)).toBeNull();
    expect(trimCount(2)).toBeNull();
  });

  it("uses k=1 for N 3–10", () => {
    expect(trimCount(3)).toBe(1);
    expect(trimCount(8)).toBe(1);
    expect(trimCount(10)).toBe(1);
  });

  it("uses k=2 for N 11–15", () => {
    expect(trimCount(11)).toBe(2);
    expect(trimCount(15)).toBe(2);
  });

  it("uses k=3 for N 16–20", () => {
    expect(trimCount(16)).toBe(3);
    expect(trimCount(20)).toBe(3);
  });

  it("uses floor((N-1)/5) at least 3 for N 21+", () => {
    expect(trimCount(21)).toBe(4); // floor(20/5)=4
    expect(trimCount(26)).toBe(5);
  });
});

describe("roundUpToNearest", () => {
  it("rounds toward +∞ to tens", () => {
    expect(roundUpToNearest(45, 10)).toBe(50);
    expect(roundUpToNearest(-45, 10)).toBe(-40);
    expect(roundUpToNearest(290, 10)).toBe(290);
    expect(roundUpToNearest(460, 10)).toBe(460);
    expect(roundUpToNearest(0, 10)).toBe(0);
  });
});

describe("computeNsDatum", () => {
  it("fails when too few scores", () => {
    const r = computeNsDatum([100, 200]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_few");
  });

  it("fails when trim would leave fewer than 2 (N=3, k=1)", () => {
    const r = computeNsDatum([100, 0, 200]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("trim_too_aggressive");
  });

  it("example A: mean 45 → datum 50", () => {
    const scores = [110, 80, -90, -100, 110, 0, 90, 80];
    const r = computeNsDatum(scores);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.k).toBe(1);
      expect(r.mean).toBe(45);
      expect(r.nsDatum).toBe(50);
      expect(r.ewDatum).toBe(-50);
    }
  });

  it("example B: mean 290 → datum 290", () => {
    const scores = [650, 620, 200, 170, 170, -100];
    const r = computeNsDatum(scores);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mean).toBe(290);
      expect(r.nsDatum).toBe(290);
    }
  });

  it("example C: mean 460 → datum 460", () => {
    const scores = [1400, 980, 480, 430, -50, -300];
    const r = computeNsDatum(scores);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mean).toBe(460);
      expect(r.nsDatum).toBe(460);
    }
  });
});
