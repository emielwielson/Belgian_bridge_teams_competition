import { NextResponse } from "next/server";
import { downloadOperationalFile } from "@/lib/files/operational-file-storage";
import {
  extensionFromPathOrName,
  inlineContentDisposition,
  mimeFromExtension,
  resolveRulingDisplayFilename,
} from "@/lib/files/ruling-file";
import { jsonError, jsonFromError, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createServiceClient } from "@/lib/supabase/server-client";

type Params = { params: Promise<{ rulingId: string; fileName: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { rulingId } = await params;
    if (!rulingId?.trim()) {
      return jsonErrorCode(ErrorCodes.api.rulingNotFound, 404);
    }

    const service = createServiceClient();
    const { data: ruling, error } = await service
      .from("rulings")
      .select("id, file_path, file_name")
      .eq("id", rulingId.trim())
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    if (!ruling?.file_path) {
      return jsonErrorCode(ErrorCodes.api.rulingNotFound, 404);
    }

    // Prefer DB file_name; URL segment is only for browser Save As / tab title.
    const filename = resolveRulingDisplayFilename(
      ruling.file_name,
      ruling.file_path,
    );
    const extension = extensionFromPathOrName(filename);
    const fallbackMime = mimeFromExtension(extension);

    let downloaded: { data: Blob; contentType: string | null };
    try {
      downloaded = await downloadOperationalFile(service, ruling.file_path);
    } catch {
      return jsonErrorCode(ErrorCodes.api.rulingNotFound, 404);
    }

    const bytes = await downloaded.data.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": downloaded.contentType || fallbackMime,
        "Content-Disposition": inlineContentDisposition(filename),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
