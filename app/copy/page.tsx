import { fetchTable } from "@/lib/supabase";
import { SectionHead, SubHead } from "@/components/SectionHead";
import { Stat } from "@/components/Stat";

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
      <SectionHead
        eyebrow="Copy"
        title="Angles &amp; tracking."
        description="Variants per ICP across email, LinkedIn, voice. Hooks, frameworks, and live performance. Full deep dive in companion HTML report."
        source="copy_angles + copy_performance"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat n={angles.length} label="variants" />
        <Stat n={Object.keys(byICP).length} label="ICPs covered" />
        <Stat n={angles.filter((a: any) => a.status === "winning").length} label="winning" />
        <Stat n={angles.filter((a: any) => a.status === "testing").length} label="in test" tone="warn" />
      </div>

      {Object.entries(byICP).map(([icp, rows]) => (
        <section key={icp} className="mb-10">
          <SubHead title={icp} hint={`${rows.length} variants`} />
          <div className="card overflow-hidden">
            <table className="data">
              <thead><tr><th>Persona</th><th>Channel</th><th>Angle</th><th>Variant / Hook</th><th className="text-right">Sends</th><th className="text-right">Replies</th><th className="text-right">Mtgs</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((a: any) => {
                  const p = perfMap[a.id] || {};
                  return (
                    <tr key={a.id}>
                      <td className="text-ink2">{a.persona}</td>
                      <td className="font-num text-muted text-[11px]">{a.channel}</td>
                      <td>
                        <div className="font-medium text-ink">{a.angle_name}</div>
                        <div className="text-[11px] text-muted mt-0.5">{a.positioning}</div>
                      </td>
                      <td className="max-w-sm">
                        <div className="text-[12px] font-medium text-ink2">{a.variant_label}</div>
                        <div className="text-[12px] italic text-accent mt-0.5">{a.hook}</div>
                      </td>
                      <td className="text-right font-num">{p.sends ?? "0"}</td>
                      <td className="text-right font-num">{p.replies ?? "0"}</td>
                      <td className="text-right font-num">{p.meetings ?? "0"}</td>
                      <td><span className="kbd uppercase">{a.status}</span></td>
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
