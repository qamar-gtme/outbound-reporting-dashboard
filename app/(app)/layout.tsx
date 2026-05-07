import Link from "next/link";
import { UserChip } from "@/components/UserChip";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/sdr", label: "SDR" },
  { href: "/smartlead", label: "Smartlead" },
  { href: "/tam", label: "TAM" },
  { href: "/tiers", label: "Tiers" },
  { href: "/copy", label: "Copy" },
  { href: "/intent", label: "Intent" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-md bg-bg/80 border-b border-line">
        <div className="max-w-[1440px] mx-auto px-8 py-4 flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="block w-2 h-2 rounded-full bg-accent group-hover:bg-warn transition" />
            <span className="font-display italic text-[19px] text-ink leading-none">open.cx</span>
            <span className="font-num text-[10px] uppercase tracking-[0.18em] text-dim">outbound</span>
          </Link>
          <nav className="flex gap-1 text-[13px]">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="px-3 py-1.5 rounded text-muted hover:text-ink hover:bg-surface2 transition"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="kbd flex items-center gap-1.5">
              <span className="block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              live
            </span>
            <UserChip />
          </div>
        </div>
      </header>
      <main className="max-w-[1440px] mx-auto px-8 py-12">{children}</main>
      <footer className="border-t border-line mt-20">
        <div className="max-w-[1440px] mx-auto px-8 py-6 flex items-center justify-between text-[11px] text-dim font-num">
          <span>open.cx outbound, internal reporting</span>
          <span>data: supabase / hubspot / salesfinity / smartlead</span>
        </div>
      </footer>
    </>
  );
}
