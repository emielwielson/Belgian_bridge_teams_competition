import { describe, expect, it } from "vitest";
import {
  buildOperationalStoragePath,
  sanitizeOperationalFilename,
  validateOperationalFile,
} from "./operational-file-upload";

describe("validateOperationalFile", () => {
  it("rejects empty files", () => {
    const file = new File([], "empty.pdf", { type: "application/pdf" });
    expect(() => validateOperationalFile(file)).toThrow("empty");
  });

  it("accepts PDF under size limit", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "doc.pdf", {
      type: "application/pdf",
    });
    const result = validateOperationalFile(file);
    expect(result.mime).toBe("application/pdf");
    expect(result.extension).toBe("pdf");
  });
});

describe("sanitizeOperationalFilename", () => {
  it("keeps a safe name and ensures extension", () => {
    expect(sanitizeOperationalFilename("My Ruling.pdf", "pdf")).toBe(
      "My Ruling.pdf",
    );
  });

  it("strips path separators and unsafe characters", () => {
    expect(sanitizeOperationalFilename("../evil\\name?.pdf", "pdf")).toBe(
      "..evilname_.pdf",
    );
  });

  it("falls back when empty after sanitize", () => {
    expect(sanitizeOperationalFilename("///", "pdf")).toBe("document.pdf");
  });
});

describe("buildOperationalStoragePath", () => {
  it("builds ruling path with uuid folder and original filename", () => {
    const path = buildOperationalStoragePath({
      purpose: "ruling",
      entityId: "match-1",
      extension: "pdf",
      fileId: "abc",
      fileName: "Board 3 Ruling.pdf",
    });
    expect(path).toBe("rulings/match-1/abc/Board 3 Ruling.pdf");
  });

  it("builds arbiter path under match id", () => {
    const path = buildOperationalStoragePath({
      purpose: "arbiter_request",
      entityId: "match-2",
      extension: "jpg",
      fileId: "xyz",
    });
    expect(path).toBe("arbiter/match-2/xyz.jpg");
  });

  it("builds penalty path under team id", () => {
    const path = buildOperationalStoragePath({
      purpose: "penalty",
      entityId: "team-1",
      extension: "pdf",
      fileId: "pen",
    });
    expect(path).toBe("penalties/team-1/pen.pdf");
  });
});
