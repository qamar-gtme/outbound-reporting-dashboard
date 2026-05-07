import Link from "next/link";
import { fetchTable } from "@/lib/supabase";

export const revalidate = 60;

export default async function HomePage() {
  const [period, sdrStats, smartleadTotals, tamInds, segTiers] = await Promise.all([
    fetchTable("sdr_perf_period?id=eq.1"),
    fetchTable("sdr_perf_by_sdr?period_id=eq.1"),
    fetchTable("smartlead_account_totals?order=period_start.desc&limit=1"),
    fetchTable("tam_industries?order=company_count_us.desc.nullslast"),
    fetchTable("segmentation_tiers"),
  ]);

  const p: any = period[0] || {};
  const totalDials = sdrStats.reduce((a: number, s: any) => a + (s.total_dials || 0), 0);
  const sl: any = smartleadTotals[0] || {};
  const totalCos = tamInds.reduce((a: number, t: any) => a + (t.company_count_us || 0), 0);
  const tierCounts: Record<string, number> = {};
  segTiers.forEach((t: any) => (tierCounts[t.tier] = (tierCounts[t.tier] || 0) + 1));

  const links = [
    { href: "/sdr", label: "Section A — US SDR Team", desc: "Salesfinity dials + HubSpot meetings + per-SDR scorecard", color: "border-accent" },
    { href: "/smartlead", label: "Section B — Smartlead", desc: "Email outbound · synced from Smartlead → Supabase", color: "border-warn" },
    { href: "/tam", label: "Section C — TAM Coverage", desc: "Industries × dials × convos · ICP gap map", color: "border-info" },
    { href: "/tiers", label: "Segmentation Tiers", desc: "27 verticals × 3 priority tiers · competitive landscape", color: "border-accent" },
    { href: "/copy", label: "Copy Angles — Deep", desc: "10 ICPs · frameworks · Avoma quotes · variants", color: "border-accent" },
    { href: "/intent", label: "Intent Signals", desc: "64 GTM signals × 17 categories", color: "border-accent" },
  ];

  return (
    <div>
      <h1 className="font-display font-bold text-5xl mb-3">Outbound Live Dashboard</h1>
      <p className="text-ink2 max-w-3xl text-lg leading-relaxed mb-10">
        Real-time view of open.cx outbound across SDR (Salesfinity + HubSpot) and Smartlead (email).
        Live data from Supabase <code className="font-mono text-warn bg-panel px-1.5 py-0.5 rounded">wqwppmbrttvdrsxplnsf</code>.
        Period: <span className="text-accent">{p.label}</span>.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-10">
        <Stat n={p.total_contacts_dialed} l="dials (period)" />
        <Stat n={p.total_connects_30s} l="connects 30s" />
        <Stat n={p.total_conversations_60s} l="convos 60s" />
        <Stat n={sl.total_sent} l="emails sent" warn />
        <Stat n={sl.total_replies} l="email replies" warn />
        <Stat n={totalCos} l="TAM cos US" info />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`block bg-panel rounded-md p-5 border-l-2 ${l.color} hover:bg-panel2 transition`}
          >
            <div className="font-display font-bold text-lg text-ink mb-1">{l.label}</div>
            <div className="text-sm text-muted">{l.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ n, l, warn, info }: { n: number | null | undefined; l: string; warn?: boolean; info?: boolean }) {
  const color = warn ? "text-warn" : info ? "text-info" : "text-accent";
  return (
    <div className="bg-panel rounded-md px-4 py-3">
      <div className={`font-mono font-bold text-2xl ${color}`}>
        {n != null ? Number(n).toLocaleString() : "—"}
      </div>
      <div className="text-xs text-dim uppercase tracking-wider mt-1">{l}</div>
    </div>
  );
}
