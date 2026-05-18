import { createSessionClient } from "@/lib/supabase/server-client";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

export async function GET() {
  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase
      .from("seasons")
      .select("id, name, status, is_active")
      .eq("is_active", true)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    if (!data) return jsonOk({ season: null });
    return jsonOk({ season: data });
  } catch (err) {
    return jsonFromError(err);
  }
}
