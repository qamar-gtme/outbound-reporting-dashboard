import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_DOMAIN = "@open.cx";

type CookieItem = { name: string; value: string; options?: CookieOptions };

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(items: CookieItem[]) {
          items.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          items.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/auth");

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (user?.email && !user.email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
    await supabase.auth.signOut();
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "domain");
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg).*)",
  ],
};
