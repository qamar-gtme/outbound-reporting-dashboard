/**
 * Daily Vercel Cron — HubSpot meetings sync.
 *
 * Pulls every meeting in HubSpot for the trailing window (default 120 days),
 * classifies channel, and upserts into `public.outbound_meetings`. Powers the
 * `/meetings` dashboard view.
 *
 * Schedule lives in `vercel.json`. Auth matches `/api/cron/sync-smartlead`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { runHubSpotMeetingsSync } from "@/lib/hubspot-meetings-sync";

export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  const key = req.nextUrl.searchParams.get("key");
  if (key && key === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const daysParam = req.nextUrl.searchParams.get("days");
  const days = daysParam ? Number(daysParam) : 120;

  try {
    console.log(`[cron/sync-hubspot] starting (days=${days})`);
    const result = await runHubSpotMeetingsSync({
      days,
      log: (m) => console.log(`[cron/sync-hubspot] ${m}`),
    });
    console.log(
      `[cron/sync-hubspot] ok — ${result.meetings_upserted}/${result.meetings_fetched} in ${result.duration_ms}ms`,
    );
    return NextResponse.json(result);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error(`[cron/sync-hubspot] threw: ${msg}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
