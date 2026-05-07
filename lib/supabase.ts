import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function fetchTable<T = any>(query: string): Promise<T[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    console.error(`Supabase fetch failed: ${res.status} ${query}`);
    return [];
  }
  return res.json();
}
