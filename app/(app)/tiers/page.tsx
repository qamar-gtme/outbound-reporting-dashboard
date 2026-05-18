import { fetchTable } from "@/lib/supabase";
import { SectionHead } from "@/components/SectionHead";
import { TiersView } from "./TiersView";

export const revalidate = 60;

export default async function TiersPage() {
  // segmentation_tiers carries the v3 shape (personas jsonb, is_marketplace,
  // business_model, mega_industry). Older rows that pre-date the migration
  // are tolerated by TiersView (graceful fallback to v2 fields).
  const tiers = await fetchTable("segmentation_tiers?order=tier.asc");

  return (
    <div>
      <SectionHead
        eyebrow="Segmentation · v3"
        title="Priority tiers"
        description="Verticals tiered by competitive landscape, not SDR perf data. v3 lays them across 18 MECE mega-industries with variable-length persona committees (3–7 per vertical) and a horizontal marketplace flag."
        source="segmentation_tiers"
      />
      <TiersView tiers={tiers as any[]} />
    </div>
  );
}
