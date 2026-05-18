import { describe, expect, it } from "vitest";
import {
  CONVENTION_CARD_MAX_BYTES,
  sanitizeConventionCardFilename,
  validateConventionCardFile,
} from "./convention-card-upload";

describe("validateConventionCardFile", () => {
  it("accepts PDF within size limit", () => {
    const file = new File(["x"], "card.pdf", { type: "application/pdf" });
    const result = validateConventionCardFile(file);
    expect(result.mime).toBe("application/pdf");
    expect(result.extension).toBe("pdf");
    expect(result.size).toBe(1);
  });

  it("rejects unsupported mime types", () => {
    const file = new File(["x"], "card.txt", { type: "text/plain" });
    expect(() => validateConventionCardFile(file)).toThrow(/PDF or image/);
  });

  it("rejects files over 10 MB", () => {
    const big = new Uint8Array(CONVENTION_CARD_MAX_BYTES + 1);
    const file = new File([big], "big.pdf", { type: "application/pdf" });
    expect(() => validateConventionCardFile(file)).toThrow(/10 MB/);
  });
});

describe("sanitizeConventionCardFilename", () => {
  it("adds extension and strips unsafe characters", () => {
    expect(sanitizeConventionCardFilename("My/System.pdf", "pdf")).toBe(
      "MySystem.pdf",
    );
  });
});
