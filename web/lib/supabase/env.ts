// NEXT_PUBLIC_* must use static process.env access so Next.js can inline them
// in client bundles. Dynamic process.env[name] is undefined in the browser.
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicPublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export function getSupabasePublicEnv() {
  if (!publicUrl) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL (set in web/.env.local and restart dev server)",
    );
  }
  if (!publicPublishableKey) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (set in web/.env.local and restart dev server)",
    );
  }
  return {
    url: publicUrl,
    publishableKey: publicPublishableKey,
  };
}

export function getSupabaseSecretKey(): string {
  if (!secretKey) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SECRET_KEY (set in web/.env.local and restart dev server)",
    );
  }
  return secretKey;
}
