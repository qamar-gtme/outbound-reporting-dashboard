/**
 * Password-reset request endpoint.
 *
 * Hardens Supabase's default `resetPasswordForEmail` flow in two ways:
 *   1. Rejects any email not on `@open.cx` (mirrors signup + middleware
 *      allowlist).
 *   2. Refuses to send a reset email when the address isn't registered.
 *      Supabase's client SDK silently swallows this (anti-enumeration);
 *      we deliberately surface it so users see a clear error.
 *
 * Lookup uses the GoTrue admin REST endpoint (`/auth/v1/admin/users?email=`)
 * because the installed `@supabase/auth-js` doesn't ship `getUserByEmail`.
 *
 * This route is PUBLIC — the user can't be signed in when requesting a reset.
 * The middleware matcher exempts `/api/auth/*` so unauthenticated requests
 * reach this handler.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DOMAIN = "@open.cx";
const COOLDOWN_MS = 5 * 60 * 1000; // 5 min per email

// Module-level map. Survives within a single warm function instance only,
// which is the best we can offer without a shared store. Good enough to
// blunt accidental hammering.
const lastSentAt = new Map<string, number>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonError(
  status: number,
  error: string,
  message: string,
) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

async function findUserByEmail(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
): Promise<{ found: boolean; error?: string }> {
  // GoTrue admin REST: GET /auth/v1/admin/users?email=<email>
  // Returns `{ users: [...] }`. An exact-match `email` query is supported
  // server-side and is far cheaper than paginating listUsers().
  const url = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      found: false,
      error: `admin lookup failed (${res.status}): ${body.slice(0, 200)}`,
    };
  }
  const data = (await res.json().catch(() => null)) as
    | { users?: Array<{ email?: string | null }> }
    | null;
  const users = data?.users ?? [];
  const match = users.some(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
  );
  return { found: match };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Invalid JSON body.");
  }

  const email = String((body as { email?: unknown })?.email ?? "")
    .trim()
    .toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return jsonError(400, "invalid_email", "Enter a valid email address.");
  }
  if (!email.endsWith(ALLOWED_DOMAIN)) {
    return jsonError(400, "domain", "Only @open.cx emails are allowed.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return jsonError(
      500,
      "config",
      "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is required.",
    );
  }

  // Cooldown — burn the request early if the same email asked recently.
  const now = Date.now();
  const last = lastSentAt.get(email) ?? 0;
  if (now - last < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: `Please wait ${waitSec}s before requesting another reset link.`,
      },
      { status: 429 },
    );
  }

  try {
    const lookup = await findUserByEmail(supabaseUrl, serviceKey, email);
    if (lookup.error) {
      return jsonError(500, "internal", lookup.error);
    }
    if (!lookup.found) {
      return jsonError(
        404,
        "not_registered",
        "No account found with this email.",
      );
    }

    // Determine redirect target. Prefer NEXT_PUBLIC_SITE_URL (canonical prod
    // origin), fall back to the request origin for preview deployments and
    // local dev.
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
      new URL(req.url).origin;
    const redirectTo = `${siteUrl}/auth/callback?next=/auth/reset`;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: resetError } = await admin.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    );
    if (resetError) {
      return jsonError(500, "internal", resetError.message);
    }

    lastSentAt.set(email, now);

    return NextResponse.json({
      ok: true,
      message: "Reset link sent. Check your inbox.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(500, "internal", message);
  }
}
