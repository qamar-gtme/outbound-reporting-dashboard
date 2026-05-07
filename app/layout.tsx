import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { UserChip } from "@/components/UserChip";

export const metadata: Metadata = {
  title: "open.cx outbound",
  description: "Outbound reporting for open.cx — SDR, Smartlead, TAM",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/sdr", label: "SDR" },
  { href: "/smartlead", label: "Smartlead" },
  { href: "/tam", label: "TAM" },
  { href: "/tiers", label: "Tiers" },
  { href: "/copy", label: "Copy" },
  { href: "/intent", label: "Intent" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=switzer@500,600,700,400&f[]=sentient@400,500,700,400i,500i,700i&f[]=erode@400,500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Martian+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        <header className="sticky top-0 z-40 backdrop-blur-md bg-bg/80 border-b border-line">
          <div className="max-w-[1440px] mx-auto px-8 py-4 flex items-center gap-10">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="block w-2 h-2 rounded-full bg-accent group-hover:bg-warn transition" />
              <span className="font-display italic text-[19px] text-ink leading-none">
                open.cx
              </span>
              <span className="font-num text-[10px] uppercase tracking-[0.18em] text-dim">
                outbound
              </span>
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
        <Analytics />
        <SpeedInsights />
        <footer className="border-t border-line mt-20">
          <div className="max-w-[1440px] mx-auto px-8 py-6 flex items-center justify-between text-[11px] text-dim font-num">
            <span>open.cx outbound, internal reporting</span>
            <span>data: supabase / hubspot / salesfinity / smartlead</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
