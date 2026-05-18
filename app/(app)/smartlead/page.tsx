import { fetchTable } from "@/lib/supabase";
import { SectionHead } from "@/components/SectionHead";

export const revalidate = 60;

type Campaign = {
  id: number;
  name: string;
  status: string;
  created_at: string | null;
  start_date: string | null;
  end_date: string | null;
  synced_at: string;
};

const STATUS_ORDER = ["ACTIVE", "PAUSED", "DRAFTED", "COMPLETED", "ARCHIVED", "STOPPED"];

const statusPill: Record<string, string> = {
  ACTIVE: "bg-accent/15 text-accent border-accent/30",
  PAUSED: "bg-warn/15 text-warn border-warn/30",
  DRAFTED: "bg-muted/20 text-muted border-muted/30",
  COMPLETED: "bg-info/15 text-info border-info/30",
  ARCHIVED: "bg-dim/20 text-dim border-dim/30",
  STOPPED: "bg-loss/15 text-loss border-loss/30",
};

const ALLOWED_FILTER = new Set(STATUS_ORDER);

export default async function SmartleadPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const rawStatus = (params.status ?? "").toUpperCase();
  const activeFilter = ALLOWED_FILTER.has(rawStatus) ? rawStatus : null;

  const query = activeFilter
    ? `smartlead_campaigns?status=eq.${activeFilter}&order=created_at.desc.nullslast`
    : "smartlead_campaigns?order=created_at.desc.nullslast";

  const campaigns = (await fetchTable(query)) as Campaign[];

  // For status counts in the header we always want the full inventory,
  // not the filtered slice.
  const all = activeFilter
    ? ((await fetchTable("smartlead_campaigns?select=status,synced_at")) as Campaign[])
    : campaigns;

  const counts: Record<string, number> = {};
  for (const c of all) counts[c.status] = (counts[c.status] ?? 0) + 1;
  const total = all.length;

  const latestSync = all.reduce<string | null>((acc, c) => {
    if (!c.synced_at) return acc;
    if (!acc || c.synced_at > acc) return c.synced_at;
    return acc;
  }, null);

  return (
    <div>
      <SectionHead
        eyebrow="Section B · Smartlead"
        title="Campaign inventory."
        description="Every Smartlead campaign in the open.cx account — active, paused, drafted, completed, archived. Synced from server.smartlead.ai into Supabase and read live by the dashboard."
        source="smartlead_campaigns"
        accent="warn"
      />

      <div className="mb-6 flex flex-wrap items-center gap-2 text-[12px]">
        <FilterChip label={`${total.toLocaleString()} total`} href="/smartlead" active={!activeFilter} />
        {STATUS_ORDER.filter((s) => counts[s]).map((s) => (
          <FilterChip
            key={s}
            label={`${counts[s].toLocaleString()} ${s.toLowerCase()}`}
            href={`/smartlead?status=${s}`}
            active={activeFilter === s}
            tone={s}
          />
        ))}
      </div>

      <div className="card overflow-hidden mb-3">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Created</th>
              <th>Start</th>
              <th>End</th>
              <th className="text-right">Campaign ID</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length ? (
              campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-ink">{c.name || "·"}</td>
                  <td>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded border text-[10.5px] uppercase tracking-[0.08em] font-medium font-num ${
                        statusPill[c.status] ?? "bg-muted/15 text-muted border-muted/30"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="font-num text-muted text-[12px]">{fmtDate(c.created_at)}</td>
                  <td className="font-num text-muted text-[12px]">{fmtDate(c.start_date)}</td>
                  <td className="font-num text-muted text-[12px]">{fmtDate(c.end_date)}</td>
                  <td className="text-right font-num text-dim text-[11px]">{c.id}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-dim italic text-center py-10">
                  {activeFilter
                    ? `No campaigns with status ${activeFilter}.`
                    : "No campaigns synced yet. Run `npm run sync:smartlead` to populate."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-dim font-num">
        Last synced: {latestSync ? relativeTime(latestSync) : "never"}
        {latestSync && <span className="text-dim/70"> · {fmtDateTime(latestSync)}</span>}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
  tone,
}: {
  label: string;
  href: string;
  active: boolean;
  tone?: string;
}) {
  const toneCls = tone ? statusPill[tone] ?? "" : "";
  return (
    <a
      href={href}
      className={`px-2.5 py-1 rounded border font-num text-[11px] uppercase tracking-[0.08em] transition-colors ${
        active
          ? toneCls || "bg-ink/10 text-ink border-ink/30"
          : "bg-transparent text-muted border-line hover:text-ink hover:border-ink/40"
      }`}
    >
      {label}
    </a>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}
