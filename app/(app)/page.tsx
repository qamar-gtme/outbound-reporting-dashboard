import { fetchTable } from "@/lib/supabase";
import { Stat } from "@/components/Stat";

export const revalidate = 60;

const US_NAMES = ["Mahmoud", "Kaze", "Khaled", "Ghaith", "Waseem", "Ikremah"];

export default async function HomePage() {
  const [sdrAll, smartleadTotals, periodStats, owners] = await Promise.all([
    fetchTable("sdr_perf_by_sdr?period_id=eq.1"),
    fetchTable("smartlead_account_totals?order=period_start.desc&limit=1"),
    fetchTable("hs_period_stats?period_id=eq.1"),
    fetchTable("hs_meetings_by_owner?period_id=eq.1"),
  ]);

  const ps: any = periodStats[0] || {};
  const sl: any = smartleadTotals[0] || {};

  const us = sdrAll.filter(
    (r: any) =>
      r.sdr_name !== "TEAM TOTAL" &&
      US_NAMES.some((n) => (r.sdr_name || "").includes(n))
  );
  const usDials = us.reduce((a: number, r: any) => a + (r.total_dials || 0), 0);
  const usConv = us.reduce(
    (a: number, r: any) => a + (r.conversations_60s || 0),
    0
  );
  const outboundMeetings = owners
    .filter((m: any) => m.is_sdr && m.sdr_region === "US")
    .reduce((a: number, m: any) => a + (m.meetings_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat n={usDials} label="dials" />
        <Stat n={usConv} label="conversations" />
        <Stat n={outboundMeetings} label="meetings" />
        <Stat n={ps.sdr_owned_deals} label="sourced deals" />
        <Stat n={sl.total_sent} label="emails sent" />
        <Stat n={sl.total_replies} label="email replies" />
      </div>
    </div>
  );
}
