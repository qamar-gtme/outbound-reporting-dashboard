#!/usr/bin/env tsx
/**
 * CLI wrapper around `runSmartleadIcpSync()` in `lib/smartlead-icp.ts`.
 *
 * Loads .env.local / .env (no extra dep) then delegates to the shared lib so
 * the same code path runs from `npm run sync:smartlead-icp` and from the
 * Vercel cron route handler.
 *
 * Idempotent. Safe to re-run.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv(path: string) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    // missing .env is fine; rely on real env
  }
}
loadDotEnv(resolve(process.cwd(), ".env.local"));
loadDotEnv(resolve(process.cwd(), ".env"));

import { runSmartleadIcpSync } from "../lib/smartlead-icp";

async function main() {
  const result = await runSmartleadIcpSync({ log: (m) => console.log(m) });
  console.log("\n=== ICP sync summary ===");
  console.log(JSON.stringify(result, null, 2));
  if (result.errors) {
    console.error("Sync failed:", result.errors);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
