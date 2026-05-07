import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieItem = { name: string; value: string; options?: CookieOptions };

const TWO_WEEKS = 60 * 60 * 24 * 14;

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(items: CookieItem[]) {
          try {
            items.forEach(({ name, value, options }) => {
              const opts = {
                ...(options || {}),
                maxAge:
                  options?.maxAge && options.maxAge > 0
                    ? options.maxAge
                    : TWO_WEEKS,
              };
              cookieStore.set(name, value, opts);
            });
          } catch {
            // called from a Server Component; safe to ignore
          }
        },
      },
    },
  );
}
