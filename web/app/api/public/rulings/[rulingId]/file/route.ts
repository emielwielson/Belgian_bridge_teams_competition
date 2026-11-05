import { NextResponse } from "next/server";
import { rulingFilePath } from "@/lib/files/ruling-file";
import { jsonError, jsonFromError, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createServiceClient } from "@/lib/supabase/server-client";

type Params = { params: Promise<{ rulingId: string }> };

/** Legacy path: redirect to a URL that ends with the display filename. */
export async function GET(request: Request, { params }: Params) {
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

    const target = new URL(
      rulingFilePath(ruling.id, ruling.file_name, ruling.file_path),
      request.url,
    );
    return NextResponse.redirect(target, 302);
  } catch (err) {
    return jsonFromError(err);
  }
}
