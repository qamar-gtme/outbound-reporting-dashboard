import { cacheLife, cacheTag } from "next/cache";
import { fetchTable } from "@/lib/supabase";
import { Stat } from "@/components/Stat";
import { SectionHead, SubHead } from "@/components/SectionHead";

type ChannelRow = {
  channel: string;
  meetings: number;
  cos: number;
  discoveries: number;
  completed: number;
  no_show: number;
};

type IndRow = {
  channel: string;
  industry: string;
  meetings: number;
  cos: number;
};

type Recent = {
  meeting_id: string;
  meeting_title: string | null;
  meeting_outcome: string | null;
  meeting_start: string | null;
  owner_name: string | null;
  channel: string | null;
  company_name: string | null;
  company_domain: string | null;
  company_industry: string | null;
  company_country: string | null;
};

const FOCUS_CHANNELS = ["sdr_us", "cold_email"];

async function loadMeetings() {
  "use cache";
  cacheLife({ revalidate: 600, expire: 3600 });
  cacheTag("meetings", "outbound-meetings");

  const channelFilter = `channel=in.(${FOCUS_CHANNELS.join(",")})`;
  return Promise.all([
    fetchTable(
      `outbound_meetings_by_channel?${channelFilter}&order=meetings.desc&limit=20`,
    ) as Promise<ChannelRow[]>,
    fetchTable(
      `outbound_meetings_by_channel_industry?${channelFilter}&order=meetings.desc&limit=400`,
    ) as Promise<IndRow[]>,
    fetchTable(
      `outbound_meetings_recent?or=(and(channel.eq.sdr_dial,owner_region.eq.us),channel.eq.cold_email)&limit=200`,
    ) as Promise<Recent[]>,
  ]);
}

const CHANNEL_LABELS: Record<string, string> = {
  sdr_us: "US SDR outbound",
  cold_email: "Cold email",
};

const CHANNEL_COLOR: Record<string, string> = {
  sdr_us: "text-accent",
  cold_email: "text-info",
};

export default async function MeetingsPage() {
  const [byChannel, byChannelInd, recent] = await loadMeetings();

  const sdrUs = byChannel.find((r) => r.channel === "sdr_us") ?? null;
  const coldEmail = byChannel.find((r) => r.channel === "cold_email") ?? null;

  const totalNew = (sdrUs?.meetings ?? 0) + (coldEmail?.meetings ?? 0);
  const totalCompleted = (sdrUs?.completed ?? 0) + (coldEmail?.completed ?? 0);
  const totalNoShow = (sdrUs?.no_show ?? 0) + (coldEmail?.no_show ?? 0);

  const indByChannel: Record<string, IndRow[]> = {};
  for (const r of byChannelInd) {
    indByChannel[r.channel] = indByChannel[r.channel] || [];
    indByChannel[r.channel].push(r);
  }

  const isEmpty = byChannel.length === 0;

  return (
    <div>
      <SectionHead
        eyebrow="Meetings · US outbound only"
        title="What's actually working"
        description="US SDR cold dial plus cold email (Smartlead reply only). UK, Saudi, inbound, and recurring customer success calls are excluded. Cold email is strict: domain only counts when a contact at that domain actually replied to a Smartlead send."
        source="outbound_meetings"
        accent="accent"
      />

      {isEmpty && (
        <div className="mb-6 rounded border border-warn/40 bg-warn/8 px-4 py-3 text-[12px] text-ink2 leading-relaxed">
          <span className="font-semibold text-warn">Table empty.</span> Run{" "}
          <code className="kbd">opencx-backward-mine/pull_all_meetings.py</code> then{" "}
          <code className="kbd">push_to_supabase.py</code> to populate. Schema in{" "}
          <code className="kbd">opencx-backward-mine/schema.sql</code>.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
        <Stat n={totalNew} label="Total bookings" hint="US SDR + cold email" />
        <Stat n={sdrUs?.meetings ?? 0} label="US SDR" hint="cold dial" />
        <Stat n={coldEmail?.meetings ?? 0} label="Cold email" hint="Smartlead reply" />
        <Stat n={totalCompleted} label="Completed" hint="meeting outcome" />
        <Stat n={totalNoShow} label="No shows" hint="meeting outcome" />
      </div>

      <SubHead title="By channel" hint="US outbound only" />
      <div className="card overflow-hidden mb-2">
        <table className="data">
          <thead>
            <tr>
              <th>Channel</th>
              <th className="text-right">Meetings</th>
              <th className="text-right">Companies</th>
              <th className="text-right">Discoveries</th>
              <th className="text-right">Completed</th>
              <th className="text-right">No show</th>
              <th className="text-right">No show %</th>
            </tr>
          </thead>
          <tbody>
            {byChannel.map((r, i) => {
              const total = r.completed + r.no_show;
              const nsPct = total > 0 ? ((r.no_show / total) * 100).toFixed(1) : "—";
              return (
                <tr key={i}>
                  <td className={`font-medium ${CHANNEL_COLOR[r.channel] || "text-ink"}`}>
                    {CHANNEL_LABELS[r.channel] || r.channel}
                  </td>
                  <td className="text-right font-num">{num(r.meetings)}</td>
                  <td className="text-right font-num text-muted">{num(r.cos)}</td>
                  <td className="text-right font-num">{num(r.discoveries)}</td>
                  <td className="text-right font-num text-accent">{num(r.completed)}</td>
                  <td className="text-right font-num text-loss">{num(r.no_show)}</td>
                  <td className="text-right font-num text-muted">{nsPct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SubHead title="Industry mix per channel" hint="where bookings are landing" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {FOCUS_CHANNELS.map((ch) => {
          const rows = (indByChannel[ch] || []).slice(0, 12);
          if (!rows.length) return null;
          const total = rows.reduce((a, r) => a + r.meetings, 0);
          return (
            <div key={ch} className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className={`text-[13px] font-semibold ${CHANNEL_COLOR[ch] || "text-foreground"}`}>
                  {CHANNEL_LABELS[ch] || ch}
                </h3>
                <p className="text-[11px] text-muted mt-0.5">{total} meetings total</p>
              </div>
              <table className="data">
                <thead>
                  <tr>
                    <th>Industry</th>
                    <th className="text-right">Meetings</th>
                    <th className="text-right">Cos</th>
                    <th className="text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const share = total > 0 ? (r.meetings / total) * 100 : 0;
                    return (
                      <tr key={i}>
                        <td className="font-medium text-ink truncate max-w-[200px]">
                          {prettyInd(r.industry)}
                        </td>
                        <td className="text-right font-num">{num(r.meetings)}</td>
                        <td className="text-right font-num text-muted">{num(r.cos)}</td>
                        <td className="text-right font-num text-muted">{share.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      <SubHead title="Recent bookings" hint="US SDR + cold email, last 200" />
      <div className="card overflow-hidden">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Channel</th>
              <th>Company</th>
              <th>Industry</th>
              <th>Country</th>
              <th>Owner</th>
              <th>Outcome</th>
              <th className="truncate">Title</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => {
              const ch =
                r.channel === "sdr_dial" ? "sdr_us" : r.channel ?? "";
              return (
                <tr key={r.meeting_id}>
                  <td className="text-muted font-num text-[11px] whitespace-nowrap">
                    {fmtDate(r.meeting_start)}
                  </td>
                  <td>
                    <span
                      className={`text-[11px] font-medium ${
                        CHANNEL_COLOR[ch] || "text-muted"
                      }`}
                    >
                      {CHANNEL_LABELS[ch] || ch}
                    </span>
                  </td>
                  <td className="font-medium text-ink">
                    {r.company_name || r.company_domain || "—"}
                  </td>
                  <td className="text-muted text-[11px]">{prettyInd(r.company_industry)}</td>
                  <td className="text-muted text-[11px]">{r.company_country || "—"}</td>
                  <td className="text-muted">{r.owner_name || "—"}</td>
                  <td className="text-[11px]">{outcome(r.meeting_outcome)}</td>
                  <td className="text-ink2 text-[11.5px] truncate max-w-[280px]">
                    {r.meeting_title || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function num(v: any) {
  return v != null ? Number(v).toLocaleString() : "0";
}
function prettyInd(s: string | null | undefined) {
  if (!s || s === "(unknown)") return <span className="text-dim">·</span> as any;
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
function outcome(s: string | null) {
  if (!s) return <span className="text-dim">·</span>;
  const map: Record<string, string> = {
    COMPLETED: "text-accent",
    SCHEDULED: "text-info",
    CANCELED: "text-loss",
    NO_SHOW: "text-loss",
    RESCHEDULED: "text-warn",
  };
  return <span className={map[s] || "text-muted"}>{s}</span>;
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}
