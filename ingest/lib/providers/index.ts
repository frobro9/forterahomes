import path from "path";
import { ListingsProvider } from "./types";
import { CsvListingsProvider } from "./csvProvider";
import { EmailListingsProvider } from "./emailProvider";
import { OneHomePortalSpecSheetParser } from "./specSheetParser";
import { extractOneHomePropertyKey } from "./oneHomePortal";

/**
 * Every already-tracked listing's OneHome property key, fetched from
 * forterahomes' own D1 (via the pipeline-facing known-onehome-keys
 * endpoint) — used to seed OneHomePortalSpecSheetParser so a property
 * tracked since a previous run is skipped BEFORE it's scraped and
 * Claude-extracted again. Ported from mls-scraper's providers/index.ts,
 * which does the equivalent query directly against its own Postgres; this
 * version has no direct database access at all (forterahomes' D1 is only
 * ever reached over HTTP, via functions/api/property-finder/*), so it
 * fetches URLs and derives keys locally instead.
 */
async function getKnownOneHomePropertyKeys(): Promise<Set<string>> {
  const baseUrl = requireEnv("PROPERTY_FINDER_BASE_URL");
  const ingestKey = requireEnv("PROPERTY_FINDER_INGEST_KEY");

  const res = await fetch(`${baseUrl}/api/property-finder/pipeline/known-onehome-keys`, {
    headers: { "x-property-finder-ingest-key": ingestKey },
  });
  if (!res.ok) {
    throw new Error(`known-onehome-keys fetch failed: HTTP ${res.status}`);
  }
  const { detailUrls } = (await res.json()) as { detailUrls: string[] };

  const keys = new Set<string>();
  for (const url of detailUrls) {
    try {
      keys.add(extractOneHomePropertyKey(url));
    } catch {
      // Malformed/legacy stored URL — skip it rather than fail the whole lookup.
    }
  }
  return keys;
}

/**
 * Provider selection is env-var driven so a licensed feed (CREA DDF,
 * Repliers, a realtor's spec-sheet mailbox, etc.) can be plugged in later
 * without changing any code outside this file. Defaults to the CSV dev
 * provider.
 */
export function getListingsProvider(): ListingsProvider {
  const providerName = process.env.LISTINGS_PROVIDER ?? "csv";

  switch (providerName) {
    case "csv":
      return new CsvListingsProvider(
        process.env.LISTINGS_CSV_PATH ??
          path.join(process.cwd(), "data", "sample-listings.csv")
      );
    case "email":
      return new EmailListingsProvider(
        {
          host: requireEnv("EMAIL_IMAP_HOST"),
          port: Number(process.env.EMAIL_IMAP_PORT ?? 993),
          secure: process.env.EMAIL_IMAP_SECURE !== "false",
          user: requireEnv("EMAIL_IMAP_USER"),
          password: requireEnv("EMAIL_IMAP_PASSWORD"),
          fromFilter: process.env.EMAIL_FROM_FILTER,
        },
        new OneHomePortalSpecSheetParser(getKnownOneHomePropertyKeys)
      );
    default:
      throw new Error(
        `Unknown LISTINGS_PROVIDER "${providerName}". Add a new provider in lib/providers/ and register it here.`
      );
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export type { ListingsProvider, RawListing } from "./types";
