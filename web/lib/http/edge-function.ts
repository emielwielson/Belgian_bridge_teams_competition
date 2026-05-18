import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  accessToken: string,
): Promise<T> {
  const { url } = getSupabasePublicEnv();
  const res = await fetch(`${url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String(payload.error)
        : res.statusText;
    throw new Error(message || `Edge function failed (${res.status})`);
  }
  return payload;
}
