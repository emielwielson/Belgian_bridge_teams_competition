import { describe, expect, it, vi } from "vitest";
import {
  getUserPreferredLocale,
  setUserPreferredLocale,
} from "./user-locale";

function mockSupabase(row: { preferred_locale: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const upsert = vi.fn().mockResolvedValue({ error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === "user_profiles") {
        return { select, upsert };
      }
      throw new Error(`unexpected table ${table}`);
    }),
    _upsert: upsert,
    _eq: eq,
  };
}

describe("user-locale", () => {
  it("returns null when no profile row exists", async () => {
    const supabase = mockSupabase(null);
    await expect(
      getUserPreferredLocale(supabase as never, "user-1"),
    ).resolves.toBeNull();
  });

  it("returns stored locale when valid", async () => {
    const supabase = mockSupabase({ preferred_locale: "nl" });
    await expect(
      getUserPreferredLocale(supabase as never, "user-1"),
    ).resolves.toBe("nl");
  });

  it("upserts preferred locale for the user", async () => {
    const supabase = mockSupabase(null);
    await setUserPreferredLocale(supabase as never, "user-1", "fr");
    expect(supabase._upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        preferred_locale: "fr",
      }),
      { onConflict: "user_id" },
    );
  });
});
