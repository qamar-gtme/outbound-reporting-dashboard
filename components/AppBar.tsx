"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

const ROUTE_LABELS: Record<string, string> = {
  "": "Dashboard",
  sdr: "SDR",
  smartlead: "Smartlead",
  icp: "ICP coverage",
  tam: "TAM",
  tiers: "Tiers",
  copy: "Copy",
  intent: "Intent",
  profile: "Profile",
};

function labelize(seg: string): string {
  if (seg in ROUTE_LABELS) return ROUTE_LABELS[seg];
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function AppBar() {
  const pathname = usePathname() ?? "/";
  const segments = pathname.split("/").filter(Boolean);

  const crumbs =
    segments.length === 0
      ? [{ href: "/", label: "Dashboard", current: true }]
      : [
          { href: "/", label: "Dashboard", current: false },
          ...segments.map((seg, i) => {
            const href = "/" + segments.slice(0, i + 1).join("/");
            return {
              href,
              label: labelize(seg),
              current: i === segments.length - 1,
            };
          }),
        ];

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-2 text-[13px]"
      >
        {crumbs.map((c, i) => (
          <span
            key={c.href}
            className="flex items-center gap-2 min-w-0"
          >
            {i > 0 && (
              <span
                aria-hidden
                className="text-dim text-[12px] select-none font-num"
              >
                /
              </span>
            )}
            {c.current ? (
              <span className="truncate font-medium text-foreground">
                {c.label}
              </span>
            ) : (
              <Link
                href={c.href}
                className="truncate text-muted hover:text-foreground transition-colors"
              >
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <CommandKChip />

        <button
          type="button"
          title="Notifications"
          aria-label="Notifications"
          className="relative grid h-7 w-7 place-items-center rounded-md border border-border bg-surface2 text-muted hover:text-foreground hover:border-border-strong transition-colors"
        >
          <BellIcon className="h-3.5 w-3.5" />
        </button>

        <div aria-hidden className="mx-1 h-5 w-px bg-border" />

        <ThemeToggle />
      </div>
    </header>
  );
}

function CommandKChip() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    }
  }, []);
  return (
    <button
      type="button"
      title="Command menu (coming soon)"
      aria-label="Open command menu"
      className="hidden sm:inline-flex h-7 items-center gap-2 rounded-md border border-border bg-surface2 px-2.5 text-[11.5px] text-muted hover:text-foreground hover:border-border-strong transition-colors"
    >
      <SearchIcon className="h-3 w-3" />
      <span>Search</span>
      <span className="font-num text-[10px] text-dim ml-1">
        {isMac ? "⌘" : "Ctrl"}K
      </span>
    </button>
  );
}

function SearchIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function BellIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1zM10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
