import { NextResponse } from "next/server";
import {
  getConventionCard,
  getConventionCardPublicUrl,
} from "@/lib/competition/convention-card-queries";
import { jsonError, jsonFromError } from "@/lib/http/api-response";
import { createSessionClient } from "@/lib/supabase/server-client";

type DownloadParams = {
  params: Promise<{ teamId: string; cardId: string }>;
};

export async function GET(_request: Request, { params }: DownloadParams) {
  try {
    const { teamId, cardId } = await params;
    const supabase = await createSessionClient();

    const card = await getConventionCard(supabase, teamId, cardId);
    if (!card) {
      return jsonError("Convention card not found", 404);
    }

    const url = getConventionCardPublicUrl(supabase, card.storage_path);
    return NextResponse.redirect(url, 302);
  } catch (err) {
    return jsonFromError(err);
  }
}
