import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server-client";

export async function POST(request: Request) {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();

  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
