export const CONVENTION_CARDS_BUCKET = "convention-cards";

export const CONVENTION_CARD_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ValidatedConventionCardFile = {
  mime: string;
  size: number;
  extension: string;
};

export function validateConventionCardFile(file: File): ValidatedConventionCardFile {
  if (!file.size) {
    throw new Error("File is empty");
  }
  if (file.size > CONVENTION_CARD_MAX_BYTES) {
    throw new Error("File must be 10 MB or smaller");
  }

  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new Error("File must be a PDF or image (JPEG, PNG, WebP)");
  }

  const extension = MIME_TO_EXT[mime];
  if (!extension) {
    throw new Error("Unsupported file type");
  }

  return { mime, size: file.size, extension };
}

export function sanitizeConventionCardFilename(name: string, extension: string): string {
  const base = name
    .replace(/[/\\]/g, "")
    .replace(/[^\w.\- ()]/g, "_")
    .trim()
    .slice(0, 120);
  const safeBase = base.length > 0 ? base : "document";
  const suffix = `.${extension}`;
  if (safeBase.toLowerCase().endsWith(suffix)) {
    return safeBase;
  }
  return `${safeBase}${suffix}`;
}

export function conventionCardStoragePath(
  teamId: string,
  cardId: string,
  filename: string,
): string {
  return `${teamId}/${cardId}/${filename}`;
}
