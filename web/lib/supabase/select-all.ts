/**
 * Paginated select helper for PostgREST/Supabase.
 *
 * API `max_rows` (default 1000) silently truncates large selects. Callers that
 * need every matching row must page with `.range()`.
 */

export const SUPABASE_PAGE_SIZE = 1000;

export type SelectPageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/**
 * Repeatedly calls `runPage(from, to)` until a page returns fewer than
 * `pageSize` rows (or an error). Concatenates all pages.
 */
export async function selectAllRows<T>(
  runPage: (from: number, to: number) => PromiseLike<SelectPageResult<T>>,
  pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<{ data: T[]; error: { message: string } | null }> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    return { data: [], error: { message: `Invalid pageSize: ${pageSize}` } };
  }

  const all: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await runPage(from, from + pageSize - 1);
    if (error) return { data: all, error };
    const page = data ?? [];
    all.push(...page);
    if (page.length < pageSize) return { data: all, error: null };
    from += pageSize;
  }
}
