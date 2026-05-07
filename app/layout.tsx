import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "open.cx — Outbound Live Dashboard",
  description: "Real-time outbound reporting for open.cx — SDR + Smartlead + TAM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-border">
          <div className="max-w-[1400px] mx-auto px-7 py-4 flex items-center gap-6">
            <Link href="/" className="font-display font-bold text-xl text-ink">
              open.cx <span className="text-accent">/</span> outbound
            </Link>
            <nav className="flex gap-4 text-sm font-mono text-muted">
              <Link href="/" className="hover:text-accent">overview</Link>
              <Link href="/sdr" className="hover:text-accent">sdr</Link>
              <Link href="/smartlead" className="hover:text-warn">smartlead</Link>
              <Link href="/tam" className="hover:text-info">tam</Link>
              <Link href="/tiers" className="hover:text-accent">tiers</Link>
              <Link href="/copy" className="hover:text-accent">copy</Link>
              <Link href="/intent" className="hover:text-accent">intent</Link>
            </nav>
            <div className="ml-auto text-xs font-mono text-dim">live · supabase</div>
          </div>
        </header>
        <main className="max-w-[1400px] mx-auto px-7 py-10">{children}</main>
      </body>
    </html>
  );
}
