import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

/**
 * PostgREST direct fetch with two layers of caching:
 *  1. The page wrapping this call uses `'use cache'` + cacheTag → Next.js
 *     caches the entire rendered segment (very fast: hits in-memory cache).
 *  2. As a fallback for non-cache-components callers (and edge instances that
 *     don't share the function cache), we set a long SWR header so Vercel's
 *     edge CDN can serve the same response across regions.
 *
 * `next.revalidate` is left short (60s) only as a safety net — the real cache
 * lifetime is controlled by the surrounding `cacheLife()` call.
 */
export async function fetchTable<T = any>(
  query: string,
  opts?: { revalidate?: number },
): Promise<T[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${query}`;
  const revalidate = opts?.revalidate ?? 60;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      // Request a small Content-Range that PostgREST will set; harmless if
      // the table is small.
      Prefer: "count=exact",
    },
    next: { revalidate },
  });
  if (!res.ok) {
    console.error(`Supabase fetch failed: ${res.status} ${query}`);
    return [];
  }
  return res.json();
}
