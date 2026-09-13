import { GenerateReportOptions } from "./reports/generateDailyReport";

interface PipelineSettingsResponse {
  preferences: {
    targetNeighborhoods: string[] | null;
    minLotSize: number | null;
    minCapRate: number | null;
    minRoi: number | null;
    defaultPropertyTypes: string[] | null;
    priceMin: number | null;
    priceMax: number | null;
  };
  assumptions: {
    costPerSqft: number;
    softCostPct: number;
    downPaymentPct: number;
    interestRate: number;
    amortizationYears: number;
    vacancyRatePct: number;
    opexPctOfGpi: number;
  };
}

/**
 * Fetches the Settings tab's current values from forterahomes' own D1 (via
 * the pipeline-facing, ingest-key-authenticated endpoint — not the
 * session-cookie-protected one the portal UI uses) and shapes them into
 * generateDailyReport's options. Ported concept from mls-scraper's
 * lib/settings/getSettings.ts, which reads the equivalent from Postgres;
 * this version has no direct database access, only HTTP.
 *
 * Falls back to generateDailyReport's own built-in defaults (DEFAULT_
 * ASSUMPTIONS / DEFAULT_THRESHOLDS, merged in there) on any fetch error,
 * so a settings-endpoint hiccup doesn't fail the whole ingest run.
 */
export async function fetchPipelineSettings(): Promise<GenerateReportOptions> {
  const baseUrl = process.env.PROPERTY_FINDER_BASE_URL;
  const ingestKey = process.env.PROPERTY_FINDER_INGEST_KEY;
  if (!baseUrl || !ingestKey) {
    console.warn("[settingsClient] PROPERTY_FINDER_BASE_URL/PROPERTY_FINDER_INGEST_KEY not set — using built-in defaults.");
    return {};
  }

  try {
    const res = await fetch(`${baseUrl}/api/property-finder/pipeline/settings`, {
      headers: { "x-property-finder-ingest-key": ingestKey },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as PipelineSettingsResponse;

    return {
      assumptions: data.assumptions,
      thresholds: {
        ...(data.preferences.minCapRate != null ? { minCapRate: data.preferences.minCapRate } : {}),
        ...(data.preferences.minRoi != null ? { minCashOnCashRoi: data.preferences.minRoi } : {}),
      },
      targetNeighborhoods: data.preferences.targetNeighborhoods ?? [],
      priceMin: data.preferences.priceMin ?? undefined,
      priceMax: data.preferences.priceMax ?? undefined,
    };
  } catch (err) {
    console.warn(`[settingsClient] Failed to fetch pipeline settings, using built-in defaults: ${(err as Error).message}`);
    return {};
  }
}
