import { describe, expect, it } from "vitest";
import {
  inlineContentDisposition,
  resolveRulingDisplayFilename,
  rulingFilePath,
} from "./ruling-file";

describe("rulingFilePath", () => {
  it("builds the public proxy path", () => {
    expect(rulingFilePath("abc")).toBe("/api/public/rulings/abc/file");
  });
});

describe("resolveRulingDisplayFilename", () => {
  it("prefers stored file_name", () => {
    expect(
      resolveRulingDisplayFilename(
        "Board 3 Ruling.pdf",
        "rulings/m1/uuid.pdf",
      ),
    ).toBe("Board 3 Ruling.pdf");
  });

  it("falls back to path basename", () => {
    expect(
      resolveRulingDisplayFilename(null, "rulings/m1/abc/My Ruling.pdf"),
    ).toBe("My Ruling.pdf");
  });
});

describe("inlineContentDisposition", () => {
  it("includes inline disposition and filename", () => {
    const header = inlineContentDisposition("Board 3 Ruling.pdf");
    expect(header).toContain("inline;");
    expect(header).toContain('filename="Board 3 Ruling.pdf"');
    expect(header).toContain("filename*=UTF-8''Board%203%20Ruling.pdf");
  });
});
