"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Client island for "Trigger Now" — POSTs to
 * `/api/segments/[slug]/trigger`, then asks the App Router to refresh the
 * RSC payload so the new queued row appears.
 *
 * The route's `revalidateTag('segment-schedule')` call invalidates the
 * server cache; `router.refresh()` triggers the re-fetch.
 */
export function TriggerNowButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okRunId, setOkRunId] = useState<number | null>(null);

  async function run() {
    setError(null);
    setOkRunId(null);
    try {
      const res = await fetch(`/api/segments/${encodeURIComponent(slug)}/trigger`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        run_id?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setOkRunId(json.run_id ?? null);
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="btn btn-sm btn-secondary disabled:opacity-50"
        aria-label={`Trigger scrape for ${slug}`}
      >
        {pending ? "Triggering…" : "Trigger now"}
      </button>
      {okRunId != null && (
        <span className="text-[10px] text-accent font-num">
          queued · run #{okRunId}
        </span>
      )}
      {error && (
        <span className="text-[10px] text-danger font-num" title={error}>
          {error.slice(0, 40)}
        </span>
      )}
    </div>
  );
}
