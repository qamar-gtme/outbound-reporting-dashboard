import { fetchTable } from "@/lib/supabase";

export const revalidate = 60;

export default async function CopyPage() {
  const [angles, perf] = await Promise.all([
    fetchTable("copy_angles?order=icp.asc"),
    fetchTable("copy_performance?limit=500"),
  ]);
  const byICP: Record<string, any[]> = {};
  angles.forEach((a: any) => (byICP[a.icp] ||= []).push(a));
  const perfMap: Record<number, any> = {};
  perf.forEach((p: any) => (perfMap[p.copy_angle_id] = p));

  return (
    <div>
      <h1 className="font-display font-bold text-4xl mb-3">Copy Angles &amp; Tracking</h1>
      <p className="text-ink2 max-w-3xl mb-6">
        {angles.length} variants across {Object.keys(byICP).length} ICPs. Detail per ICP including frameworks, hooks, full bodies, voicemails, objections in the deep report (HTML in <code className="text-warn">opencx-deliverables/</code>).
      </p>

      {Object.entries(byICP).map(([icp, rows]) => (
        <section key={icp} className="mb-10">
          <h2 className="font-display font-bold text-2xl mb-3 pb-2 border-b border-border">{icp}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>
                {["Persona", "Channel", "Angle", "Variant", "Hook", "Sends", "Replies", "Mtgs", "Status"].map(h => (
                  <th key={h} className="text-left font-display font-bold text-[11px] uppercase tracking-wider text-ink2 bg-panel px-3 py-2 border-b border-border">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map((a: any, i: number) => {
                  const p = perfMap[a.id] || {};
                  return (
                    <tr key={a.id} className={i % 2 ? "bg-panel2" : ""}>
                      <td className="px-3 py-2 border-b border-border">{a.persona}</td>
                      <td className="px-3 py-2 border-b border-border font-mono text-xs">{a.channel}</td>
                      <td className="px-3 py-2 border-b border-border"><b>{a.angle_name}</b><div className="text-xs text-muted">{a.positioning}</div></td>
                      <td className="px-3 py-2 border-b border-border">{a.variant_label}</td>
                      <td className="px-3 py-2 border-b border-border italic text-accent text-xs">{a.hook}</td>
                      <td className="px-3 py-2 border-b border-border font-mono">{p.sends ?? "—"}</td>
                      <td className="px-3 py-2 border-b border-border font-mono">{p.replies ?? "—"}</td>
                      <td className="px-3 py-2 border-b border-border font-mono">{p.meetings ?? "—"}</td>
                      <td className="px-3 py-2 border-b border-border"><span className="font-mono text-xs uppercase bg-accent/20 text-accent px-2 py-0.5 rounded">{a.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
