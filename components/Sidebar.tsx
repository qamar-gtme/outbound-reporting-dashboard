"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavItem = { href: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> };
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: GridIcon }],
  },
  {
    label: "Outbound",
    items: [
      { href: "/sdr", label: "SDR", icon: PhoneIcon },
      { href: "/smartlead", label: "Smartlead", icon: MailIcon },
      { href: "/smartlead/icp", label: "ICP Coverage", icon: TargetIcon },
    ],
  },
  {
    label: "Strategy",
    items: [
      { href: "/tam", label: "TAM", icon: GlobeIcon },
      { href: "/tiers", label: "Tiers", icon: LayersIcon },
      { href: "/copy", label: "Copy", icon: TypeIcon },
      { href: "/intent", label: "Intent", icon: SignalIcon },
    ],
  },
];

const LS_KEY = "opencx.sidebar.collapsed";

export function Sidebar({ email }: { email: string | null }) {
  const pathname = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const v = localStorage.getItem(LS_KEY);
      if (v === "1") setCollapsed(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS_KEY, collapsed ? "1" : "0");
    } catch {}
    document.documentElement.style.setProperty(
      "--sidebar-w",
      collapsed ? "64px" : "240px",
    );
  }, [collapsed, mounted]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const initials = (email ?? "").trim().slice(0, 2).toUpperCase() || "OC";

  return (
    <aside
      data-collapsed={collapsed}
      className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-surface transition-[width] duration-150 ${
        collapsed ? "w-[64px]" : "w-[240px]"
      }`}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          {collapsed ? (
            <BrandMark />
          ) : (
            <LogoFull className="h-[22px] w-auto text-foreground" />
          )}
        </Link>
        {!collapsed && (
          <span className="ml-auto font-num text-[9px] uppercase tracking-[0.18em] text-dim">
            outbound
          </span>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group, gi) => (
          <div key={group.label} className={gi === 0 ? "mb-5" : "mb-5 mt-1"}>
            {!collapsed && (
              <div className="app-sidebar-group-label">{group.label}</div>
            )}
            <ul className="space-y-[2px]">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-active={active}
                      className="app-sidebar-link"
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="h-[15px] w-[15px] shrink-0" />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="mx-3 mb-2 flex h-7 items-center justify-center gap-1.5 rounded-md border border-border bg-surface2 text-[11px] text-muted hover:text-foreground hover:border-border-strong transition-colors"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronIcon
          className={`h-3 w-3 transition-transform ${collapsed ? "rotate-180" : ""}`}
        />
        {!collapsed && <span>Collapse</span>}
      </button>

      {/* User chip */}
      <div ref={menuRef} className="relative border-t border-border p-2">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Account menu"
          className={`flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-surface2 ${
            menuOpen ? "bg-surface2" : ""
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10.5px] font-semibold font-num text-accent">
            {initials}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-foreground">
                {email ?? "Signed out"}
              </span>
              <span className="block truncate text-[10.5px] text-muted font-num">
                open.cx
              </span>
            </span>
          )}
          {!collapsed && (
            <ChevronUpDownIcon className="h-3.5 w-3.5 shrink-0 text-dim" />
          )}
        </button>

        {menuOpen && (
          <div
            role="menu"
            className={`absolute z-40 rounded-md border border-border bg-popover p-1 ${
              collapsed
                ? "left-full bottom-0 ml-2 w-44"
                : "bottom-full left-2 right-2 mb-2"
            }`}
          >
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[12.5px] text-foreground hover:bg-surface2"
            >
              <UserIcon className="h-3.5 w-3.5 text-muted" />
              Profile
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[12.5px] text-foreground hover:bg-danger/10 hover:text-danger transition-colors"
              >
                <SignOutIcon className="h-3.5 w-3.5 text-muted" />
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // Special-case: /smartlead/icp shouldn't also light up /smartlead.
  if (href === "/smartlead") return pathname === "/smartlead";
  return pathname === href || pathname.startsWith(href + "/");
}

import { LogoFull, LogoMark } from "@/components/Logo";

function BrandMark() {
  return <LogoMark className="h-7 w-7 shrink-0 text-foreground" />;
}

/* ----- Icons (1.5px stroke, 16px) ------------------------------------- */

function GridIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function PhoneIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function MailIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 7 9-7" />
    </svg>
  );
}
function TargetIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  );
}
function GlobeIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
function LayersIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m12 2 9 5-9 5-9-5z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}
function TypeIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 7V5h16v2M9 5v14M15 19h-6" />
    </svg>
  );
}
function SignalIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 20v-4M9 20v-9M14 20v-13M19 20V4" />
    </svg>
  );
}
function ChevronIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
function DotsIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}
function ChevronUpDownIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m7 9 5-5 5 5" />
      <path d="m7 15 5 5 5-5" />
    </svg>
  );
}
function UserIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
function SignOutIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
