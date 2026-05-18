/**
 * Daily Vercel Cron — runs the Smartlead → Supabase sync.
 *
 * Vercel Cron hits this with `Authorization: Bearer <CRON_SECRET>` when the
 * `CRON_SECRET` project env var is set. We also accept `?key=<secret>` as a
 * local-testing fallback. Anything else → 401.
 *
 * Schedule lives in `vercel.json` (`0 9 * * *` daily = 09:00 UTC).
 */

import { NextResponse, type NextRequest } from "next/server";
import { runSmartleadSync } from "@/lib/smartlead-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // If no secret is configured, refuse to run — fail closed.
    return false;
  }
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  const key = req.nextUrl.searchParams.get("key");
  if (key && key === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  try {
    console.log("[cron/sync-smartlead] starting");
    const result = await runSmartleadSync({
      log: (m) => console.log(`[cron/sync-smartlead] ${m}`),
    });

    if (result.errors) {
      console.error(`[cron/sync-smartlead] failed: ${result.errors}`);
      return NextResponse.json(
        {
          ok: false,
          error: result.errors,
          campaigns_fetched: result.campaigns_fetched,
          campaigns_upserted: result.campaigns_upserted,
          ran_at: result.ran_at,
        },
        { status: 500 },
      );
    }

    console.log(
      `[cron/sync-smartlead] ok — ${result.campaigns_upserted}/${result.campaigns_fetched} in ${result.duration_ms}ms`,
    );

    return NextResponse.json({
      ok: true,
      campaigns_fetched: result.campaigns_fetched,
      campaigns_upserted: result.campaigns_upserted,
      campaigns_new: result.campaigns_new,
      campaigns_updated: result.campaigns_updated,
      status_breakdown: result.status_breakdown,
      ran_at: result.ran_at,
      duration_ms: result.duration_ms,
    });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error(`[cron/sync-smartlead] threw: ${msg}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
