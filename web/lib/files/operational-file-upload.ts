export const OPERATIONAL_FILES_BUCKET = "operational-files";

export const OPERATIONAL_FILE_MAX_BYTES = 10 * 1024 * 1024;

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

export type OperationalFilePurpose = "ruling" | "arbiter_request";

export type ValidatedOperationalFile = {
  mime: string;
  size: number;
  extension: string;
};

export function validateOperationalFile(file: File): ValidatedOperationalFile {
  if (!file.size) {
    throw new Error("File is empty");
  }
  if (file.size > OPERATIONAL_FILE_MAX_BYTES) {
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

export function buildOperationalStoragePath(params: {
  purpose: OperationalFilePurpose;
  entityId: string;
  extension: string;
  fileId?: string;
}): string {
  const id = params.fileId ?? crypto.randomUUID();
  const folder =
    params.purpose === "ruling" ? "rulings" : "arbiter";
  return `${folder}/${params.entityId}/${id}.${params.extension}`;
}
