import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ALLOWED_DOMAIN = "@open.cx";

type CookieItem = { name: string; value: string; options?: CookieOptions };

const TWO_WEEKS = 60 * 60 * 24 * 14;

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

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing-code`);
  }

  // Build the response first so we can set auth cookies on it directly.
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
              // server component context guard
            }
            response.cookies.set(name, value, opts);
          });
        },
      },
    },
  );

  const { error, data } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  const email = data.user?.email?.toLowerCase() ?? "";
  if (!email.endsWith(ALLOWED_DOMAIN)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  return response;
}
