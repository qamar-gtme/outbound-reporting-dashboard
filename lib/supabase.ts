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

/* ---- ICP Scrape Schedule ------------------------------------------------- */

export type SegmentScheduleRow = {
  id: number;
  segment_slug: string;
  segment_name: string;
  cron_expression: string;
  is_active: boolean | null;
  last_run_id: number | null;
  last_run_at: string | null;
  next_run_at: string | null;
  scrape_config: {
    mega_slug?: string | null;
    sub_slug?: string | null;
    vertical_slugs?: string[] | null;
    [k: string]: unknown;
  } | null;
};

export type SegmentScrapeRunRow = {
  id: number;
  segment_slug: string;
  segment_name: string | null;
  mega_slug: string | null;
  sub_slug: string | null;
  vertical_slugs: string[] | null;
  status: string;
  company_count: number | null;
  dm_count: number | null;
  verified_phone_count: number | null;
  pushed_contact_count: number | null;
  created_task_count: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_log: string | null;
};

export type SegmentScheduleWithLastRun = SegmentScheduleRow & {
  last_run: SegmentScrapeRunRow | null;
};

/**
 * Fetch the ICP-scrape schedule rows alongside the most-recent run for each.
 * Tagged with `segment-schedule` so the manual-trigger route can invalidate
 * via `updateTag('segment-schedule')` (Next 16 Cache Components API).
 */
export async function fetchSegmentSchedule(): Promise<
  SegmentScheduleWithLastRun[]
> {
  const [schedules, runs] = await Promise.all([
    fetchTable<SegmentScheduleRow>(
      "segment_schedule?select=id,segment_slug,segment_name,cron_expression,is_active,last_run_id,last_run_at,next_run_at,scrape_config&order=segment_name.asc&limit=200",
    ),
    // Pull the most recent ~500 runs and pick the latest per slug. Cheap at
    // this scale and avoids needing a join we can't cleanly express via
    // PostgREST.
    fetchTable<SegmentScrapeRunRow>(
      "segment_scrape_runs?select=id,segment_slug,segment_name,mega_slug,sub_slug,vertical_slugs,status,company_count,dm_count,verified_phone_count,pushed_contact_count,created_task_count,started_at,completed_at,error_log&order=started_at.desc.nullslast&limit=500",
    ),
  ]);

  const latestBySlug = new Map<string, SegmentScrapeRunRow>();
  for (const r of runs) {
    if (!latestBySlug.has(r.segment_slug)) latestBySlug.set(r.segment_slug, r);
  }

  return schedules.map((s) => ({
    ...s,
    last_run: latestBySlug.get(s.segment_slug) ?? null,
  }));
}
