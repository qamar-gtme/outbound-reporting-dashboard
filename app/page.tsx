import Link from "next/link";
import { fetchTable } from "@/lib/supabase";
import { Stat } from "@/components/Stat";
import { SectionHead, SubHead } from "@/components/SectionHead";

export const revalidate = 60;

const US_NAMES = ["Mahmoud", "Kaze", "Khaled", "Ghaith", "Waseem", "Ikremah"];

export default async function HomePage() {
  const [period, sdrAll, smartleadTotals, tamInds, segTiers, periodStats, owners] = await Promise.all([
    fetchTable("sdr_perf_period?id=eq.1"),
    fetchTable("sdr_perf_by_sdr?period_id=eq.1"),
    fetchTable("smartlead_account_totals?order=period_start.desc&limit=1"),
    fetchTable("tam_industries?order=company_count_us.desc.nullslast"),
    fetchTable("segmentation_tiers"),
    fetchTable("hs_period_stats?period_id=eq.1"),
    fetchTable("hs_meetings_by_owner?period_id=eq.1"),
  ]);

  const p: any = period[0] || {};
  const ps: any = periodStats[0] || {};
  const sl: any = smartleadTotals[0] || {};

  const us = sdrAll.filter((r: any) => r.sdr_name !== "TEAM TOTAL" && US_NAMES.some((n) => (r.sdr_name || "").includes(n)));
  const usDials = us.reduce((a: number, r: any) => a + (r.total_dials || 0), 0);
  const usConv = us.reduce((a: number, r: any) => a + (r.conversations_60s || 0), 0);
  const outboundMeetings = owners.filter((m: any) => m.is_sdr && m.sdr_region === "US").reduce((a: number, m: any) => a + (m.meetings_count || 0), 0);

  const totalCos = tamInds.reduce((a: number, t: any) => a + (t.company_count_us || 0), 0);
  const tierCounts: Record<string, number> = {};
  segTiers.forEach((t: any) => (tierCounts[t.tier] = (tierCounts[t.tier] || 0) + 1));

  const sections = [
    { href: "/sdr", title: "US SDR Team", desc: "Salesfinity dials, connects, conversations. HubSpot meetings booked from outbound only.", tone: "accent" as const },
    { href: "/smartlead", title: "Smartlead", desc: "Email outbound. Sent, replies, positive replies. Synced from Smartlead into Supabase.", tone: "warn" as const },
    { href: "/tam", title: "TAM Coverage", desc: "Total addressable companies vs dials and conversations per industry, sub industry, vertical.", tone: "info" as const },
    { href: "/tiers", title: "Segmentation Tiers", desc: "27 verticals across three priority tiers. Driven by competitive landscape, not SDR perf data.", tone: "accent" as const },
    { href: "/copy", title: "Copy Angles", desc: "Per ICP variants, hooks, frameworks, performance tracking.", tone: "accent" as const },
    { href: "/intent", title: "Intent Signals", desc: "64 GTM signals across 17 categories with precision and recall scoring.", tone: "accent" as const },
  ];

  const dotMap: Record<string, string> = { accent: "bg-accent", warn: "bg-warn", info: "bg-info" };

  return (
    <div>
      <SectionHead
        eyebrow={`Period ${p.period_start ?? ""} to ${p.period_end ?? ""}`}
        title="Outbound, in one place."
        description="A single live view of US SDR activity, Smartlead email outbound, TAM coverage, and ICP intelligence. Numbers reflect outbound attribution only."
      />

      <SubHead title="Headline" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Stat n={usDials} label="US dials" />
        <Stat n={usConv} label="conversations" />
        <Stat n={outboundMeetings} label="outbound meetings" hint="US SDR booked, period to date" />
        <Stat n={ps.sdr_owned_deals} label="SDR-sourced deals" />
        <Stat n={sl.total_sent} label="emails sent" tone="warn" hint="Smartlead, pre-launch" />
        <Stat n={sl.total_replies} label="email replies" tone="warn" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat n={totalCos} label="addressable cos US" tone="info" hint="50+ employees, CX-sellable" />
        <Stat n={tamInds.length} label="L1 industries" tone="info" />
        <Stat n={tierCounts["Tier 1"] || 0} label="Tier 1 verticals" />
        <Stat n={segTiers.length} label="total tier permutations" />
      </div>

      <SubHead title="Sections" />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card p-6 hover:bg-surface2 hover:border-line2 transition group"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={`block w-1.5 h-1.5 rounded-full ${dotMap[s.tone]}`} />
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium">{s.tone}</span>
            </div>
            <div className="font-display text-[22px] tracking-tight text-ink mb-2 group-hover:text-accent transition">{s.title}</div>
            <p className="text-[13px] text-ink2 leading-relaxed">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
