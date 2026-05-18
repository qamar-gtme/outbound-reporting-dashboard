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

## Smartlead sync

Pulls all open.cx Smartlead campaigns into the `smartlead_campaigns` table and
writes a per-run summary to `smartlead_sync_runs`. Idempotent — re-running is
safe.

Shared logic lives in `lib/smartlead-sync.ts` and is invoked by both the CLI
script and the Vercel Cron route.

### Run manually (local)

```bash
npm run sync:smartlead
```

### Vercel Cron (production)

| Item | Value |
|---|---|
| Route | `GET /api/cron/sync-smartlead` |
| Schedule | `0 9 * * *` (daily 09:00 UTC = 04:00 ET = 14:00 PKT) |
| Auth | `Authorization: Bearer $CRON_SECRET` (Vercel injects automatically) |

Required env vars on Vercel (Project → Settings → Environment Variables):

- `CRON_SECRET` — random token, e.g. `openssl rand -hex 32`
- `SMARTLEAD_API_KEY_OPENCX` — open.cx Smartlead API key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key (server only)
- `NEXT_PUBLIC_SUPABASE_URL` — already set for the app

The cron registers automatically on the next deploy after `vercel.json` lands.
`CRON_SECRET` must be set in Vercel project env for production to authorize
the scheduled request.

### Test locally

```bash
# Header auth (mirrors Vercel Cron)
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/sync-smartlead

# Or via querystring fallback
curl "http://localhost:3000/api/cron/sync-smartlead?key=$CRON_SECRET"
```

The route returns
`{ok, campaigns_fetched, campaigns_upserted, status_breakdown, ran_at, …}`
on success, or `{ok: false, error}` with HTTP 500 on failure.
