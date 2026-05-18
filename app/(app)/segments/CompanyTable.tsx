"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Client-only interactive table for the /segments page.
 *
 * Owns: full-text search (company OR title, debounced via useDeferredValue),
 * column sort, pagination (URL-bound), CSV export of the currently-filtered
 * dataset.
 *
 * Receives the *already server-filtered* lead set (after mega/sub/vertical/
 * campaign/replied filters) so the only work it does is search + sort + page.
 */

export type Lead = {
  smartlead_lead_id?: number;
  company_name: string | null;
  title: string | null;
  country: string | null;
  email: string | null;
  linkedin_url: string | null;
  status: string | null;
  is_replied: boolean | null;
  reply_count: number | null;
  sent_count: number | null;
  classification_confidence: number | null;
  classified_mega: string | null;
  classified_sub: string | null;
  classified_vertical: string | null;
  campaign_id: number | null;
};

type SortKey =
  | "company"
  | "title"
  | "country"
  | "status"
  | "sent"
  | "replies"
  | "campaign";

const PAGE_SIZE = 100;

// Brand-consistent status pill colors. Smartlead's actual statuses today are
// BLOCKED/STARTED/COMPLETED, but we map any of the documented states so this
// keeps working if Smartlead adds new ones later.
const statusPill: Record<string, string> = {
  REPLIED: "bg-accent/12 text-accent",
  IN_PROGRESS: "bg-info/15 text-info",
  STARTED: "bg-info/15 text-info",
  NOT_STARTED: "bg-surface2 text-muted",
  BOUNCED: "bg-danger/12 text-danger",
  BLOCKED: "bg-danger/12 text-danger",
  UNSUBSCRIBED: "bg-warn/15 text-warn",
  COMPLETED: "bg-surface2 text-muted",
  PAUSED: "bg-warn/15 text-warn",
};

function statusFor(l: Lead): string {
  if (l.is_replied) return "REPLIED";
  if (l.status) return l.status.toUpperCase();
  return "NOT_STARTED";
}

export function CompanyTable({
  leads,
  campaignNamesById,
  initialPage,
  showBreadcrumbCol,
  csvBaseName,
}: {
  leads: Lead[];
  campaignNamesById: Record<string, string>;
  initialPage: number;
  showBreadcrumbCol: boolean;
  csvBaseName: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get("search") ?? "");
  const deferredSearch = useDeferredValue(search);

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "replies",
    dir: "desc",
  });

  // Apply search client-side. Dataset is at most ~7,400 rows.
  const searched = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      const a = (l.company_name ?? "").toLowerCase();
      const b = (l.title ?? "").toLowerCase();
      return a.includes(q) || b.includes(q);
    });
  }, [leads, deferredSearch]);

  const sorted = useMemo(() => {
    const arr = [...searched];
    const dir = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      // Stable secondary sort: replied first, then sent count, then alpha.
      const ar = a.is_replied ? 1 : 0;
      const br = b.is_replied ? 1 : 0;

      let primary = 0;
      switch (sort.key) {
        case "company":
          primary =
            (a.company_name ?? "").localeCompare(b.company_name ?? "") * dir;
          break;
        case "title":
          primary = (a.title ?? "").localeCompare(b.title ?? "") * dir;
          break;
        case "country":
          primary = (a.country ?? "").localeCompare(b.country ?? "") * dir;
          break;
        case "status":
          primary = statusFor(a).localeCompare(statusFor(b)) * dir;
          break;
        case "sent":
          primary = ((a.sent_count ?? 0) - (b.sent_count ?? 0)) * dir;
          break;
        case "replies":
          primary = ((a.reply_count ?? 0) - (b.reply_count ?? 0)) * dir;
          break;
        case "campaign":
          primary = (
            campaignNamesById[String(a.campaign_id)] ?? ""
          ).localeCompare(campaignNamesById[String(b.campaign_id)] ?? "") * dir;
          break;
      }
      if (primary !== 0) return primary;
      // Reply-first tiebreak, then alpha
      if (ar !== br) return br - ar;
      return (a.company_name ?? "").localeCompare(b.company_name ?? "");
    });
    return arr;
  }, [searched, sort, campaignNamesById]);

  const total = sorted.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, initialPage), lastPage);
  const startIdx = (page - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(startIdx, startIdx + PAGE_SIZE);

  function pageHref(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    return `?${next.toString()}`;
  }

  function setSortKey(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "company" || key === "title" || key === "country" ? "asc" : "desc" },
    );
  }

  function exportCsv() {
    const headers = [
      "company",
      "title",
      "country",
      "email",
      "linkedin_url",
      "status",
      "is_replied",
      "sent_count",
      "reply_count",
      "campaign_id",
      "campaign_name",
      "classified_mega",
      "classified_sub",
      "classified_vertical",
      "classification_confidence",
    ];
    const escape = (v: unknown): string => {
      if (v == null) return "";
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines: string[] = [];
    lines.push(headers.join(","));
    for (const l of sorted) {
      lines.push(
        [
          l.company_name,
          l.title,
          l.country,
          l.email,
          l.linkedin_url,
          statusFor(l),
          l.is_replied ? "true" : "false",
          l.sent_count ?? 0,
          l.reply_count ?? 0,
          l.campaign_id ?? "",
          campaignNamesById[String(l.campaign_id)] ?? "",
          l.classified_mega ?? "",
          l.classified_sub ?? "",
          l.classified_vertical ?? "",
          l.classification_confidence ?? "",
        ]
          .map(escape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `opencx-segments-${csvBaseName}-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Soft sync search into the URL so it survives reloads / share links.
    const next = new URLSearchParams(params.toString());
    if (search.trim()) next.set("search", search.trim());
    else next.delete("search");
    next.delete("page");
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div>
      {/* Table-scoped action row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <form
          onSubmit={onSearchSubmit}
          className="relative flex items-center min-w-[220px] sm:min-w-[280px]"
        >
          <span className="absolute left-2.5 text-dim pointer-events-none">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search company or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-8 h-8 text-[12px]"
            aria-label="Search companies"
          />
        </form>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-dim font-num">
            {total.toLocaleString()} {total === 1 ? "row" : "rows"}
          </span>
          <button
            type="button"
            onClick={exportCsv}
            disabled={total === 0}
            className="btn btn-sm btn-secondary"
            aria-label="Export currently filtered rows as CSV"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
              <path d="M5 21h14" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      <div className="card overflow-hidden mb-3">
        {pageRows.length ? (
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <SortableTh
                    label="Company"
                    sortKey="company"
                    current={sort}
                    onClick={setSortKey}
                  />
                  <SortableTh
                    label="Title"
                    sortKey="title"
                    current={sort}
                    onClick={setSortKey}
                  />
                  <SortableTh
                    label="Country"
                    sortKey="country"
                    current={sort}
                    onClick={setSortKey}
                  />
                  <th>Email</th>
                  <th className="text-center w-[44px]">In</th>
                  <SortableTh
                    label="Status"
                    sortKey="status"
                    current={sort}
                    onClick={setSortKey}
                  />
                  <SortableTh
                    label="Sent"
                    sortKey="sent"
                    current={sort}
                    onClick={setSortKey}
                    align="right"
                  />
                  <SortableTh
                    label="Replies"
                    sortKey="replies"
                    current={sort}
                    onClick={setSortKey}
                    align="right"
                  />
                  <SortableTh
                    label="Campaign"
                    sortKey="campaign"
                    current={sort}
                    onClick={setSortKey}
                  />
                  {showBreadcrumbCol && <th>Bucket</th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((l, i) => (
                  <CompanyRow
                    key={`${l.smartlead_lead_id ?? i}-${startIdx + i}`}
                    lead={l}
                    campaignName={
                      campaignNamesById[String(l.campaign_id)] ?? ""
                    }
                    showBreadcrumb={showBreadcrumbCol}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-title">
              No companies match these filters
            </div>
            <div className="empty-state-hint">
              Try clearing search or jumping back to{" "}
              <Link href="/segments" className="text-accent hover:underline">
                all segments
              </Link>
              .
            </div>
          </div>
        )}
      </div>

      {/* Pagination footer */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-[11px] text-dim font-num">
          <span>
            Showing{" "}
            <span className="text-ink2">
              {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, total)}
            </span>{" "}
            of <span className="text-ink2">{total.toLocaleString()}</span>
          </span>
          <div className="flex items-center gap-1">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                scroll={false}
                className="inline-flex h-7 items-center rounded-md border border-border bg-transparent px-2.5 text-muted hover:text-foreground hover:border-border-strong transition-colors"
              >
                ← Prev
              </Link>
            ) : (
              <span className="inline-flex h-7 items-center rounded-md border border-border bg-transparent px-2.5 text-dim opacity-50">
                ← Prev
              </span>
            )}
            <span className="px-2 text-muted">
              Page {page} of {lastPage}
            </span>
            {page < lastPage ? (
              <Link
                href={pageHref(page + 1)}
                scroll={false}
                className="inline-flex h-7 items-center rounded-md border border-border bg-transparent px-2.5 text-muted hover:text-foreground hover:border-border-strong transition-colors"
              >
                Next →
              </Link>
            ) : (
              <span className="inline-flex h-7 items-center rounded-md border border-border bg-transparent px-2.5 text-dim opacity-50">
                Next →
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableTh({
  label,
  sortKey,
  current,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  current: { key: SortKey; dir: "asc" | "desc" };
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = current.key === sortKey;
  const arrow = active ? (current.dir === "asc" ? "↑" : "↓") : "";
  return (
    <th
      className={`${align === "right" ? "text-right" : ""} cursor-pointer select-none`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-dim text-[9px] w-[8px] inline-block">{arrow}</span>
      </span>
    </th>
  );
}

function CompanyRow({
  lead: l,
  campaignName,
  showBreadcrumb,
}: {
  lead: Lead;
  campaignName: string;
  showBreadcrumb: boolean;
}) {
  const status = statusFor(l);
  const pill = statusPill[status] ?? "bg-surface2 text-muted";
  const title = (l.title ?? "").trim();
  const titleTrunc = title.length > 40 ? title.slice(0, 40) + "…" : title;
  const confLow =
    l.classification_confidence != null && l.classification_confidence < 0.6;

  return (
    <tr>
      <td className="text-ink font-medium max-w-[200px] truncate" title={l.company_name ?? undefined}>
        {l.company_name || "—"}
        {confLow && (
          <span
            className="ml-1.5 align-middle text-[9.5px] font-num text-dim"
            title={`Classification confidence ${(l.classification_confidence! * 100).toFixed(0)}%`}
          >
            {(l.classification_confidence! * 100).toFixed(0)}%
          </span>
        )}
      </td>
      <td className="text-ink2 text-[12px] max-w-[260px] truncate" title={title || undefined}>
        {titleTrunc || "—"}
      </td>
      <td>
        {l.country ? (
          <span className="inline-flex items-center rounded border border-border bg-surface2 px-1.5 h-5 text-[10px] font-num uppercase tracking-[0.06em] text-muted">
            {l.country}
          </span>
        ) : (
          <span className="text-dim">—</span>
        )}
      </td>
      <td className="max-w-[220px] truncate">
        {l.email ? (
          <a
            href={`mailto:${l.email}`}
            className="text-dim hover:text-accent text-[11.5px] font-num"
            title={l.email}
          >
            {l.email}
          </a>
        ) : (
          <span className="text-dim">—</span>
        )}
      </td>
      <td className="text-center">
        {l.linkedin_url ? (
          <a
            href={l.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-5 w-5 rounded text-muted hover:text-accent hover:bg-accent/10 transition-colors"
            aria-label="Open LinkedIn profile"
            title="LinkedIn"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-3 w-3"
              aria-hidden="true"
            >
              <path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5V9h3v10zM6.5 7.5a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5zM19 19h-3v-5.5c0-1.05-.85-1.5-1.5-1.5s-1.5.5-1.5 1.5V19h-3V9h3v1.25c.5-.75 1.5-1.5 3-1.5 1.94 0 3 1.34 3 3.5V19z" />
            </svg>
          </a>
        ) : (
          <span className="text-dim">—</span>
        )}
      </td>
      <td>
        <span className={`pill-cell ${pill}`}>{status}</span>
      </td>
      <td className="text-right font-num text-ink2 text-[12px]">
        {l.sent_count ?? 0}
      </td>
      <td
        className={`text-right font-num text-[12px] ${
          (l.reply_count ?? 0) > 0 ? "text-accent font-medium" : "text-dim"
        }`}
      >
        {l.reply_count ?? 0}
      </td>
      <td
        className="text-ink2 text-[11.5px] max-w-[200px] truncate"
        title={campaignName}
      >
        {campaignName || "—"}
      </td>
      {showBreadcrumb && (
        <td className="text-dim text-[11px] max-w-[260px] truncate">
          {[
            l.classified_mega,
            l.classified_sub,
            l.classified_vertical,
          ]
            .filter(Boolean)
            .join(" / ") || "—"}
        </td>
      )}
    </tr>
  );
}
