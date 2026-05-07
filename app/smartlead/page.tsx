import { fetchTable } from "@/lib/supabase";

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
      <div className="flex items-baseline gap-3 mb-2">
        <h1 className="font-display font-bold text-3xl text-warn">Section B — Smartlead</h1>
        <span className="font-mono text-[10px] uppercase tracking-wider text-dim bg-panel px-2 py-1 rounded">
          source: Supabase smartlead_*
        </span>
      </div>
      <p className="text-ink2 max-w-3xl mb-6">
        Email outbound from Smartlead campaigns synced into Supabase. <span className="text-warn">Pre-launch (zeros)</span> until first sends fire.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        <S n={t.campaigns_active} l="campaigns" />
        <S n={t.total_sent} l="emails sent" />
        <S n={t.total_delivered} l="delivered" />
        <S n={t.total_opens} l="opens" />
        <S n={t.total_replies} l="replies" />
        <S n={t.total_positive_replies} l="positive replies" />
        <S n={t.total_meetings_booked} l="meetings" />
        <S n={t.total_bounces} l="bounces" />
        <S n={t.total_unsubscribes} l="unsubs" />
        <S n={t.total_spam_complaints} l="spam" />
        <S n={t.domains_active} l="domains" />
        <S n={t.inboxes_total} l="inboxes" />
      </div>

      <div className="bg-panel rounded p-8 text-center text-dim italic mb-10">
        <div className="font-mono font-bold text-warn text-4xl mb-2">0 / 0</div>
        Pre-launch — no Smartlead sends yet. Daily metrics will flow into <code className="text-warn">smartlead_daily_metrics</code> via cron once campaigns activate.
      </div>

      <h2 className="font-display font-bold text-xl mt-10 mb-3 pb-2 border-b border-border">Active campaigns</h2>
      <Tbl head={["Campaign", "ICP", "Vertical", "Persona", "Geo", "Status", "Inboxes"]}
        rows={
          campaigns.length
            ? campaigns.map((c: any) => [c.name, c.icp, c.vertical, c.persona, c.geo, c.status, c.inboxes_count])
            : [[<i key="e">No Smartlead campaigns synced yet.</i>, "", "", "", "", "", ""]]
        }
      />

      <h2 className="font-display font-bold text-xl mt-10 mb-3 pb-2 border-b border-border">Daily metrics (60d)</h2>
      <Tbl head={["Date", "Campaign", "Sent", "Delivered", "Opens", "Replies", "Pos. replies", "Mtgs", "Bounces"]}
        rows={
          daily.length
            ? daily.map((d: any) => [d.metric_date, d.smartlead_campaign_id, d.sent, d.delivered, d.opens, d.replies, d.positive_replies, d.meetings_booked, d.bounces])
            : [[<i key="e">No daily metrics synced yet.</i>, "", "", "", "", "", "", "", ""]]
        }
      />

      <h2 className="font-display font-bold text-xl mt-10 mb-3 pb-2 border-b border-border">Sync schema</h2>
      <Tbl head={["Table", "Purpose", "Refresh"]}
        rows={[
          ["smartlead_campaigns", "Campaign meta (ICP, vertical, persona, domains, inboxes)", "On campaign create/update via webhook"],
          ["smartlead_daily_metrics", "Per-campaign daily rollup (sent/opens/replies/etc.)", "Daily cron 02:00 UTC"],
          ["smartlead_prospects", "Per-prospect contacted state (email, hubspot_contact_id, has_replied)", "Real-time via webhook"],
          ["smartlead_account_totals", "Account-wide period rollup for top-line tiles", "Daily cron after smartlead_daily_metrics"],
        ]}
      />
    </div>
  );
}

function S({ n, l }: { n: any; l: string }) {
  return (
    <div className="bg-panel rounded-md px-4 py-3">
      <div className="font-mono font-bold text-2xl text-warn">{n != null ? Number(n).toLocaleString() : "—"}</div>
      <div className="text-xs text-dim uppercase tracking-wider mt-1">{l}</div>
    </div>
  );
}

function Tbl({ head, rows }: { head: string[]; rows: any[][] }) {
  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm">
        <thead><tr>{head.map((h) => <th key={h} className="text-left font-display font-bold text-[11px] uppercase tracking-wider text-ink2 bg-panel px-3 py-2 border-b border-border">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className={i % 2 ? "bg-panel2" : ""}>{r.map((c, j) => <td key={j} className="px-3 py-2 border-b border-border align-top">{c == null || c === "" ? "—" : c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
