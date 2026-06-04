/**
 * Weekly Vercel Cron — kicks off the recurring ICP scrape pipeline.
 *
 * For every active row in `segment_schedule` whose `next_run_at` is due,
 * we:
 *   1. Insert a new `segment_scrape_runs` row (status='queued') carrying
 *      whatever `mega_slug`, `sub_slug`, and `vertical_slugs` the row's
 *      `scrape_config` JSON specifies.
 *   2. POST a webhook to `SEGMENT_WORKER_WEBHOOK_URL` if set, otherwise
 *      just log and leave the row queued for a manual/external worker.
 *   3. Update the schedule's `last_run_id` / `last_run_at` and bump
 *      `next_run_at` forward by one weekly tick (next Monday 13:00 UTC).
 *
 * Auth: same pattern as `/api/cron/sync-smartlead` — `Authorization:
 * Bearer ${CRON_SECRET}` header (Vercel auto-injects on cron invocations)
 * or `?key=<secret>` for local testing.
 *
 * Manual single-segment trigger: `?force=<segment_slug>` will process
 * exactly that slug regardless of `next_run_at`. Still requires the
 * Bearer secret — the per-user manual trigger lives at
 * `/api/segments/[slug]/trigger`.
 *
 * Schedule lives in `vercel.json` (`0 13 * * 1` = Mondays 13:00 UTC).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  const key = req.nextUrl.searchParams.get("key");
  if (key && key === secret) return true;
  return false;
}

type ScrapeConfig = {
  mega_slug?: string | null;
  sub_slug?: string | null;
  vertical_slugs?: string[] | null;
  worker_url?: string | null;
  [k: string]: unknown;
};

type ScheduleRow = {
  id: number;
  segment_slug: string;
  segment_name: string;
  cron_expression: string;
  next_run_at: string | null;
  scrape_config: ScrapeConfig | null;
};

/**
 * Compute the next weekly tick: Monday 13:00 UTC strictly after `from`.
 * We deliberately don't parse cron_expression — the table is locked to a
 * single weekly cadence today. If we add daily/multi-tick later, swap
 * this for a real cron parser (e.g. `cron-parser`).
 */
export function nextMondayThirteenUtc(from: Date): Date {
  const d = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate(),
      13,
      0,
      0,
      0,
    ),
  );
  // Day-of-week: Sun=0 .. Sat=6. We want Mon=1.
  const day = d.getUTCDay();
  let daysToAdd: number;
  if (day < 1) {
    daysToAdd = 1 - day; // Sun -> +1
  } else if (day === 1) {
    // If we're already past 13:00 UTC on Monday `from`, jump to next Monday.
    daysToAdd = from.getTime() >= d.getTime() ? 7 : 0;
  } else {
    daysToAdd = 7 - day + 1; // Tue..Sat -> wrap to next Mon
  }
  d.setUTCDate(d.getUTCDate() + daysToAdd);
  return d;
}

function svcClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type TriggerResult = {
  run_id: number;
  segment_slug: string;
};

/**
 * Core "kick a scrape" routine — shared between the cron handler and the
 * authenticated-user `/api/segments/[slug]/trigger` route.
 */
export async function triggerSegmentScrape(
  schedule: ScheduleRow,
  opts: { bumpNextRun: boolean; forced?: boolean; actor?: string },
): Promise<TriggerResult> {
  const sb = svcClient();
  const cfg = schedule.scrape_config ?? {};
  const now = new Date().toISOString();

  // 1. Insert queued run row.
  const insertPayload = {
    segment_slug: schedule.segment_slug,
    segment_name: schedule.segment_name,
    mega_slug: cfg.mega_slug ?? null,
    sub_slug: cfg.sub_slug ?? null,
    vertical_slugs: cfg.vertical_slugs ?? null,
    status: "queued" as const,
    started_at: now,
  };
  const { data: runRows, error: insertErr } = await sb
    .from("segment_scrape_runs")
    .insert(insertPayload)
    .select("id")
    .single();
  if (insertErr || !runRows) {
    throw new Error(
      `insert segment_scrape_runs failed: ${insertErr?.message ?? "no row"}`,
    );
  }
  const runId = runRows.id as number;

  // 2. Fire-and-forget webhook to the worker, if configured.
  const workerUrl = cfg.worker_url || process.env.SEGMENT_WORKER_WEBHOOK_URL;
  if (workerUrl) {
    try {
      const r = await fetch(workerUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.SEGMENT_WORKER_TOKEN
            ? { authorization: `Bearer ${process.env.SEGMENT_WORKER_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          run_id: runId,
          segment_slug: schedule.segment_slug,
          segment_name: schedule.segment_name,
          mega_slug: cfg.mega_slug ?? null,
          sub_slug: cfg.sub_slug ?? null,
          vertical_slugs: cfg.vertical_slugs ?? null,
          forced: !!opts.forced,
          actor: opts.actor ?? "cron",
        }),
        // Worker may take a while to ack — don't block the cron.
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) {
        console.error(
          `[segment-scrape] worker webhook returned ${r.status} for run ${runId}`,
        );
      }
    } catch (e: any) {
      console.error(
        `[segment-scrape] worker webhook threw for run ${runId}: ${e?.message ?? e}`,
      );
    }
  } else {
    console.log(
      `[segment-scrape] no worker webhook configured — run ${runId} left queued for ${schedule.segment_slug}`,
    );
  }

  // 3. Update schedule pointers.
  const update: Record<string, unknown> = {
    last_run_id: runId,
    last_run_at: now,
    updated_at: now,
  };
  if (opts.bumpNextRun) {
    update.next_run_at = nextMondayThirteenUtc(new Date()).toISOString();
  }
  const { error: updErr } = await sb
    .from("segment_schedule")
    .update(update)
    .eq("id", schedule.id);
  if (updErr) {
    console.error(
      `[segment-scrape] schedule update failed for ${schedule.segment_slug}: ${updErr.message}`,
    );
  }

  // Invalidate the segments page cache so the new run shows up. Use Next
  // 16's `updateTag` (Cache Components API). Dynamic-import so this file
  // remains importable from environments where the cache module isn't
  // wired (e.g. a future script harness).
  try {
    const { updateTag } = await import("next/cache");
    updateTag("segment-schedule");
  } catch {
    /* fine — best-effort */
  }

  return { run_id: runId, segment_slug: schedule.segment_slug };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const force = req.nextUrl.searchParams.get("force");

  let schedules: ScheduleRow[] = [];
  try {
    const sb = svcClient();
    let q = sb
      .from("segment_schedule")
      .select(
        "id, segment_slug, segment_name, cron_expression, next_run_at, scrape_config, is_active",
      )
      .eq("is_active", true);
    if (force) {
      q = q.eq("segment_slug", force);
    } else {
      // due means: next_run_at is null OR next_run_at <= now
      const nowIso = new Date().toISOString();
      q = q.or(`next_run_at.is.null,next_run_at.lte.${nowIso}`);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    schedules = (data ?? []) as ScheduleRow[];
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 },
    );
  }

  const runIds: number[] = [];
  const errors: { segment_slug: string; error: string }[] = [];

  for (const s of schedules) {
    try {
      const { run_id } = await triggerSegmentScrape(s, {
        bumpNextRun: true,
        forced: !!force,
        actor: force ? "cron-force" : "cron",
      });
      runIds.push(run_id);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.error(`[segment-scrape] ${s.segment_slug} failed: ${msg}`);
      errors.push({ segment_slug: s.segment_slug, error: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    checked: schedules.length,
    triggered: runIds.length,
    run_ids: runIds,
    errors,
  });
}
