/**
 * Status pill for a segment scrape run. Mirrors the visual language of the
 * Smartlead campaign-status pills (`pill-cell` + tone classes).
 *
 * Tone mapping:
 *   queued    -> neutral grey
 *   scraping  -> info (blue/cyan)
 *   enriching -> info
 *   pushing   -> warn (yellow) — actively writing to GHL/HubSpot
 *   completed -> accent (green)
 *   failed    -> danger (red)
 *   (anything else) -> neutral grey, lowercased
 */

const TONE: Record<string, string> = {
  queued: "bg-surface2 text-muted",
  scraping: "bg-info/15 text-info",
  enriching: "bg-info/15 text-info",
  pushing: "bg-warn/15 text-warn",
  completed: "bg-accent/12 text-accent",
  failed: "bg-danger/12 text-danger",
};

export function StatusPill({ status }: { status: string | null | undefined }) {
  const s = (status ?? "—").toLowerCase();
  const cls = TONE[s] ?? "bg-surface2 text-muted";
  return (
    <span className={`pill-cell ${cls}`} title={`status: ${s}`}>
      {s}
    </span>
  );
}
