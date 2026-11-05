import { getAppBaseUrl } from "@/lib/notifications/postponement-email";
import { sanitizeOperationalFilename } from "./operational-file-upload";

export function rulingFilePath(rulingId: string): string {
  return `/api/public/rulings/${rulingId}/file`;
}

export function absoluteRulingFileUrl(rulingId: string): string {
  return `${getAppBaseUrl()}${rulingFilePath(rulingId)}`;
}

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function extensionFromPathOrName(value: string): string {
  const base = value.split("/").pop() ?? value;
  const dot = base.lastIndexOf(".");
  if (dot < 0 || dot === base.length - 1) return "pdf";
  return base.slice(dot + 1).toLowerCase();
}

export function mimeFromExtension(extension: string): string {
  return EXT_TO_MIME[extension.toLowerCase()] ?? "application/octet-stream";
}

export function resolveRulingDisplayFilename(
  fileName: string | null | undefined,
  filePath: string,
): string {
  const pathBase = filePath.split("/").pop() || "document.pdf";
  const extension = extensionFromPathOrName(fileName?.trim() || pathBase);
  if (fileName?.trim()) {
    return sanitizeOperationalFilename(fileName.trim(), extension);
  }
  return pathBase;
}

/** Content-Disposition for inline viewing with a Save As filename. */
export function inlineContentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
