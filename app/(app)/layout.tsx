import { Sidebar } from "@/components/Sidebar";
import { AppBar } from "@/components/AppBar";
import { createClient } from "@/lib/supabase-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar email={email} />

      {/* The sidebar is fixed; reserve space for it via the --sidebar-w
          custom property which the Sidebar updates when collapsed. */}
      <div
        className="transition-[padding-left] duration-150"
        style={{ paddingLeft: "var(--sidebar-w, 240px)" }}
      >
        <AppBar />
        <main className="px-6 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
