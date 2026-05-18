import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { AppBar } from "@/components/AppBar";
import { createClient } from "@/lib/supabase-server";
import Loading from "./loading";

/**
 * Async server component that reads the current user's email from the
 * Supabase auth cookie. Lives in its own component so the layout can wrap
 * it in <Suspense>, which is required by Next 16 Cache Components — any
 * dynamic data source (cookies, headers, searchParams) must live inside
 * a Suspense boundary or the entire route blocks on it.
 */
async function SidebarWithAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <Sidebar email={user?.email ?? null} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* The sidebar streams in once the auth cookie has been validated.
          While that resolves we render the same Sidebar shell with no email
          so the user sees the chrome immediately — no layout shift since
          the width is the same. */}
      <Suspense fallback={<Sidebar email={null} />}>
        <SidebarWithAuth />
      </Suspense>

      {/* The sidebar is fixed; reserve space for it via the --sidebar-w
          custom property which the Sidebar updates when collapsed. */}
      <div
        className="transition-[padding-left] duration-150"
        style={{ paddingLeft: "var(--sidebar-w, 240px)" }}
      >
        <AppBar />
        <main className="px-6 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1320px]">
            {/* Every page is wrapped in its own Suspense boundary so that
                each page's `'use cache'` data loads stream independently
                of the auth-dependent sidebar. */}
            <Suspense fallback={<Loading />}>{children}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
