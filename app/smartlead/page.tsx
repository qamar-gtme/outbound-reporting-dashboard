import { fetchTable } from "@/lib/supabase";
import { Stat } from "@/components/Stat";
import { SectionHead, SubHead } from "@/components/SectionHead";

export const revalidate = 60;

export default async function SmartleadPage() {
  const [totals, campaigns, daily] = await Promise.all([
    fetchTable("smartlead_account_totals?order=period_start.desc&limit=1"),
    fetchTable("smartlead_campaigns?order=inserted_at.desc&limit=50"),
    fetchTable("smartlead_daily_metrics?order=metric_date.desc&limit=60"),
  ]);
  const t: any = totals[0] || {};

  return (
    <div>
      <SectionHead
        eyebrow="Section B"
        title="Smartlead"
        description="Email outbound from Smartlead campaigns, synced into Supabase. Pre launch zeros until first sends fire."
        source="smartlead_*"
        accent="warn"
      />

      <SubHead title="Account totals" hint={t.period_label ?? "current month"} />
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-2">
        <Stat n={t.campaigns_active} label="active campaigns" tone="warn" />
        <Stat n={t.total_sent} label="emails sent" tone="warn" />
        <Stat n={t.total_delivered} label="delivered" tone="warn" />
        <Stat n={t.total_opens} label="opens" tone="warn" hint="Apple MPP discounted" />
        <Stat n={t.total_replies} label="replies" tone="warn" />
        <Stat n={t.total_positive_replies} label="positive replies" tone="warn" />
        <Stat n={t.total_meetings_booked} label="meetings" tone="warn" />
        <Stat n={t.total_bounces} label="bounces" tone="warn" />
        <Stat n={t.total_unsubscribes} label="unsubs" tone="warn" />
        <Stat n={t.total_spam_complaints} label="spam complaints" tone="warn" />
        <Stat n={t.domains_active} label="domains active" tone="warn" />
        <Stat n={t.inboxes_total} label="inboxes" tone="warn" />
      </div>

      <div className="card p-10 text-center my-8">
        <div className="font-display text-[64px] text-warn font-num leading-none mb-3">0 / 0</div>
        <div className="text-ink2 max-w-md mx-auto text-[14px]">
          Pre launch. Daily metrics flow into <span className="kbd">smartlead_daily_metrics</span> via cron once campaigns activate.
        </div>
      </div>

      <SubHead title="Active campaigns" />
      <div className="card overflow-hidden mb-2">
        <table className="data">
          <thead>
            <tr><th>Campaign</th><th>ICP</th><th>Vertical</th><th>Persona</th><th>Geo</th><th>Status</th><th className="text-right">Inboxes</th></tr>
          </thead>
          <tbody>
            {campaigns.length ? campaigns.map((c: any, i: number) => (
              <tr key={i}>
                <td className="font-medium text-ink">{c.name}</td>
                <td>{c.icp || "·"}</td>
                <td>{c.vertical || "·"}</td>
                <td>{c.persona || "·"}</td>
                <td>{c.geo || "·"}</td>
                <td><span className="kbd">{c.status || "·"}</span></td>
                <td className="text-right font-num">{c.inboxes_count ?? "·"}</td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="text-dim italic text-center py-6">No campaigns synced.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <SubHead title="Daily metrics" hint="last 60 days" />
      <div className="card overflow-hidden mb-2">
        <table className="data">
          <thead>
            <tr><th>Date</th><th>Campaign</th><th className="text-right">Sent</th><th className="text-right">Delivered</th><th className="text-right">Opens</th><th className="text-right">Replies</th><th className="text-right">Positive</th><th className="text-right">Mtgs</th><th className="text-right">Bounces</th></tr>
          </thead>
          <tbody>
            {daily.length ? daily.map((d: any, i: number) => (
              <tr key={i}>
                <td className="font-num text-muted">{d.metric_date}</td>
                <td>{d.smartlead_campaign_id}</td>
                <td className="text-right font-num">{d.sent}</td>
                <td className="text-right font-num">{d.delivered}</td>
                <td className="text-right font-num">{d.opens}</td>
                <td className="text-right font-num">{d.replies}</td>
                <td className="text-right font-num text-accent">{d.positive_replies}</td>
                <td className="text-right font-num">{d.meetings_booked}</td>
                <td className="text-right font-num text-loss">{d.bounces}</td>
              </tr>
            )) : (
              <tr><td colSpan={9} className="text-dim italic text-center py-6">No daily metrics synced.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <SubHead title="Sync schema" hint="Smartlead to Supabase" />
      <div className="card overflow-hidden">
        <table className="data">
          <thead><tr><th>Table</th><th>Purpose</th><th>Refresh</th></tr></thead>
          <tbody>
            <tr><td className="font-num text-warn">smartlead_campaigns</td><td>Campaign metadata, ICP, vertical, persona, domains</td><td className="text-muted">webhook on create or update</td></tr>
            <tr><td className="font-num text-warn">smartlead_daily_metrics</td><td>Per campaign daily rollup, sent, opens, replies, bounces</td><td className="text-muted">cron 02:00 UTC</td></tr>
            <tr><td className="font-num text-warn">smartlead_prospects</td><td>Per prospect contact state, has_replied, has_bounced</td><td className="text-muted">real time webhook</td></tr>
            <tr><td className="font-num text-warn">smartlead_account_totals</td><td>Account wide period rollup for dashboard tiles</td><td className="text-muted">cron after daily metrics</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
