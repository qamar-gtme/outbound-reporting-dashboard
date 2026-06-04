/**
 * Manual "Trigger Now" for an ICP segment scrape.
 *
 * Auth: this route is covered by the global middleware which already requires
 * a valid Supabase session on an `@open.cx` email. We re-verify the user here
 * for defense-in-depth (middleware can be bypassed if the matcher pattern
 * changes), and to record `actor=email` on the run.
 *
 * Body: none. The segment is taken from the path segment.
 *
 * Returns: `{ ok: true, run_id }` on success, or `{ ok: false, error }`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createSvcClient } from "@supabase/supabase-js";
import { triggerSegmentScrape } from "@/app/api/cron/segment-scrape/route";

export const maxDuration = 60;

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSvcClient(url, key, { auth: { persistSession: false } });
}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "missing_slug" },
      { status: 400 },
    );
  }

  // 1. Verify user session.
  let actor = "anonymous";
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user || !user.email?.toLowerCase().endsWith("@open.cx")) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      );
    }
    actor = user.email;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `auth check failed: ${e?.message ?? e}` },
      { status: 500 },
    );
  }

  // 2. Load the schedule row.
  const sbSvc = svc();
  const { data: schedule, error: selErr } = await sbSvc
    .from("segment_schedule")
    .select(
      "id, segment_slug, segment_name, cron_expression, next_run_at, scrape_config",
    )
    .eq("segment_slug", slug)
    .maybeSingle();
  if (selErr) {
    return NextResponse.json(
      { ok: false, error: selErr.message },
      { status: 500 },
    );
  }
  if (!schedule) {
    return NextResponse.json(
      { ok: false, error: `no schedule for slug=${slug}` },
      { status: 404 },
    );
  }

  // 3. Mirror what the cron does for this single segment. We deliberately
  //    do NOT bump `next_run_at` on a manual trigger — keep the weekly
  //    cadence stable.
  try {
    const result = await triggerSegmentScrape(schedule as any, {
      bumpNextRun: false,
      forced: true,
      actor,
    });
    return NextResponse.json({ ok: true, run_id: result.run_id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
