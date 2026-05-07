# open.cx — Outbound Reporting Dashboard

Live outbound reporting dashboard for open.cx. Pulls from Supabase `wqwppmbrttvdrsxplnsf`.

## Stack

- Next.js 15 (App Router, RSC)
- TypeScript
- Tailwind CSS
- Supabase (REST via fetch, anon key)
- Vercel (deploy)

## Pages

| Path | Section | Source |
|---|---|---|
| `/` | Overview | All tables |
| `/sdr` | US SDR team | Salesfinity + HubSpot |
| `/smartlead` | Smartlead email | smartlead_* tables (synced) |
| `/tam` | TAM coverage | tam_industries / subs / verticals |
| `/tiers` | Segmentation tiers | segmentation_tiers (competitive-landscape driven) |
| `/copy` | Copy angles | copy_angles + copy_performance |
| `/intent` | Intent signals | intent_signals (64 signals) |

## Run locally

```bash
npm install
npm run dev
# http://localhost:3000
```

`.env.local` must include:
```
NEXT_PUBLIC_SUPABASE_URL=https://wqwppmbrttvdrsxplnsf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<see .env.local.example>
```

## Deploy

```bash
vercel link        # link to qamar-opencx team
vercel --prod      # deploy to production
```

## Data refresh

Pages use `export const revalidate = 60`. For real-time, add Supabase Realtime subscriptions.

## Smartlead sync (pending)

`smartlead_*` tables ready in Supabase. Sync job to be built using open.cx Smartlead API key.
