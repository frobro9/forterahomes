/**
 * Production entry point, run on a schedule by
 * .github/workflows/property-finder-ingest.yml. Ported from mls-scraper's
 * scripts/runIngest.ts — same reasoning applies: env vars must be loaded
 * before jobs/dailyPipeline.ts (and anything it imports that reads
 * process.env at import time) is imported, and a static top-level import
 * would be hoisted above that, so this uses a dynamic import after
 * loading .env.local instead.
 *
 * Usage: npx tsx scripts/runIngest.ts
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvLocalIfPresent() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return; // CI supplies env vars directly via secrets
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
  }
}

async function main() {
  loadEnvLocalIfPresent();
  const { runDailyPipeline } = await import("../jobs/dailyPipeline");
  const results = await runDailyPipeline();
  console.log(`Ingest complete: ${results.length} listing(s) analyzed.`);
}

main().catch((err) => {
  console.error("[runIngest] Pipeline run failed:", err);
  process.exit(1);
});
