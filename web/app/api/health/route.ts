import { NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerClient } from "@/lib/supabase/server-client";

export async function GET() {
  try {
    getSupabasePublicEnv();

    const supabase = createServerClient();
    const { error } = await supabase.from("regions").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, supabase: "error", message: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, supabase: "connected" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, supabase: "misconfigured", message },
      { status: 503 },
    );
  }
}
