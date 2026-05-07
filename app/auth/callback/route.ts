import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ALLOWED_DOMAIN = "@open.cx";
const TWO_WEEKS = 60 * 60 * 24 * 14;

type CookieItem = { name: string; value: string; options?: CookieOptions };

function withMaxAge(opts: CookieOptions | undefined): CookieOptions {
  return {
    ...(opts || {}),
    maxAge: opts?.maxAge && opts.maxAge > 0 ? opts.maxAge : TWO_WEEKS,
  };
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const response = NextResponse.redirect(`${origin}${next}`);
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(items: CookieItem[]) {
          items.forEach(({ name, value, options }) => {
            const opts = withMaxAge(options);
            try {
              cookieStore.set(name, value, opts);
            } catch {
              // server context guard
            }
            response.cookies.set(name, value, opts);
          });
        },
      },
    },
  );

  // OAuth + magic link path: exchange code for session
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      );
    }
  }

  // Read the now-authed user (covers OAuth, magic link, and phone OTP paths)
  const { data: userData } = await supabase.auth.getUser();
  const email = (userData.user?.email ?? "").toLowerCase();
  const phone = userData.user?.phone ?? "";

  if (!userData.user) {
    return NextResponse.redirect(`${origin}/login?error=no-session`);
  }

  // Email path: enforce @open.cx
  if (email && !email.endsWith(ALLOWED_DOMAIN)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  // Phone-only path: check allowlist
  if (!email && phone) {
    const { data: allowed } = await supabase
      .from("allowed_phones")
      .select("phone")
      .eq("phone", phone)
      .maybeSingle();
    if (!allowed) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=phone-allowlist`);
    }
  }

  return response;
}
