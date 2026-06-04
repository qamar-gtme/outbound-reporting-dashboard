import type { SegmentScheduleWithLastRun } from "@/lib/supabase";
import { StatusPill } from "./StatusPill";
import { TriggerNowButton } from "./TriggerNowButton";

/**
 * "ICP Scrape Status" section on /segments. Shows every row in
 * `segment_schedule` plus its most-recent run, with a manual Trigger Now
 * button for logged-in @open.cx users.
 *
 * Server component — formatting helpers stay here so the row payload
 * shipped to the client is minimal.
 */

function formatCronWeekly(expr: string): string {
  // We only emit weekly cron exprs today (`0 13 * * 1`). If the cadence
  // ever changes we'll get an "expr" tooltip on hover and a plain-string
  // fallback so the UI never lies.
  if (expr === "0 13 * * 1") return "Weekly · Mondays 13:00 UTC";
  return expr;
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return "—";
  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  const ago = diff > 0;
  const m = 60_000,
    h = 60 * m,
    d = 24 * h;
  let label: string;
  if (abs < m) label = "just now";
  else if (abs < h) label = `${Math.round(abs / m)}m`;
  else if (abs < d) label = `${Math.round(abs / h)}h`;
  else if (abs < 30 * d) label = `${Math.round(abs / d)}d`;
  else label = `${Math.round(abs / (30 * d))}mo`;
  if (label === "just now") return label;
  return ago ? `${label} ago` : `in ${label}`;
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  const v = value == null ? "—" : value.toLocaleString();
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9.5px] uppercase tracking-[0.12em] text-dim font-num">
        {label}
      </span>
      <span className="text-[13px] text-ink2 font-num font-semibold tabular-nums">
        {v}
      </span>
    </div>
  );
}

export function IcpScrapeStatus({
  schedules,
}: {
  schedules: SegmentScheduleWithLastRun[];
}) {
  if (!schedules.length) {
    return (
      <div className="card empty-state">
        <div className="empty-state-title">No scheduled scrapes yet</div>
        <div className="empty-state-hint">
          Add a row to <span className="font-num">segment_schedule</span> with{" "}
          <span className="font-num">is_active=true</span> and a weekly cron
          expression to start the recurring pipeline.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {schedules.map((row) => {
        const run = row.last_run;
        return (
          <div
            key={row.id}
            className="card px-4 py-3.5 flex flex-col gap-3 md:flex-row md:items-start md:gap-6"
          >
            {/* Identity */}
            <div className="min-w-0 md:w-64 md:shrink-0">
              <div className="text-[13px] font-semibold text-ink truncate">
                {row.segment_name}
              </div>
              <div className="text-[10.5px] text-dim font-num mt-0.5 uppercase tracking-[0.08em] truncate">
                {row.segment_slug}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center h-5 px-1.5 rounded text-[10px] font-num uppercase tracking-[0.08em] ${
                    row.is_active
                      ? "bg-accent/12 text-accent"
                      : "bg-surface2 text-dim"
                  }`}
                  title={row.is_active ? "Active" : "Inactive"}
                >
                  {row.is_active ? "● active" : "○ inactive"}
                </span>
              </div>
              <div
                className="mt-1.5 text-[10.5px] text-muted font-num"
                title={row.cron_expression}
              >
                {formatCronWeekly(row.cron_expression)}
              </div>
            </div>

            {/* Run status + counts */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <StatusPill status={run?.status} />
                <span className="text-[11px] text-muted font-num">
                  last run · {relTime(run?.started_at ?? row.last_run_at)}
                </span>
                <span className="text-dim text-[11px] font-num">·</span>
                <span className="text-[11px] text-muted font-num">
                  next · {relTime(row.next_run_at)}
                </span>
                {run?.error_log && (
                  <span
                    className="text-[10.5px] text-danger font-num truncate max-w-xs"
                    title={run.error_log}
                  >
                    err: {run.error_log.slice(0, 60)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-3 py-2 border border-border rounded-md bg-surface/40">
                <StatTile label="Cos" value={run?.company_count} />
                <StatTile label="DMs" value={run?.dm_count} />
                <StatTile
                  label="Verified phones"
                  value={run?.verified_phone_count}
                />
                <StatTile label="Pushed" value={run?.pushed_contact_count} />
                <StatTile label="Tasks" value={run?.created_task_count} />
              </div>
            </div>

            {/* Action */}
            <div className="md:shrink-0">
              <TriggerNowButton slug={row.segment_slug} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
