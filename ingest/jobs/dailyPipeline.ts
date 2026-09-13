import { generateDailyReport } from "../lib/reports/generateDailyReport";
import { fetchPipelineSettings } from "../lib/settingsClient";
import { AnalysisResult } from "../lib/reports/types";

const SQM_TO_SQFT = 10.7639;

function toIngestResult(result: AnalysisResult) {
  const { listing, zone, buildable, proForma } = result;
  return {
    listing: {
      provider: listing.provider,
      providerListingId: listing.providerListingId,
      address: listing.address,
      neighborhood: listing.neighborhood || null,
      lat: listing.lat,
      lng: listing.lng,
      listPrice: listing.listPrice,
      lotSizeSqft: listing.lotAreaSqm ? listing.lotAreaSqm * SQM_TO_SQFT : null,
      lotWidthM: listing.lotWidthM,
      lotDepthM: listing.lotDepthM,
      buildingSqft: listing.buildingSqft,
      yearBuilt: listing.yearBuilt,
      propertyType: listing.propertyType,
      status: listing.status,
      rawPayload: listing.raw,
    },
    zone: {
      zoneCode: zone.zoneCode,
      zoneName: zone.zoneName,
      sourceBylawSection: zone.sourceBylawSection,
    },
    subZoneCode: result.subZoneCode ?? null,
    rawZoneCode: result.rawZoneCode ?? null,
    buildable: {
      maxUnits: buildable.maxUnits,
      unitMixSuggestion: buildable.unitMixSuggestion,
      buildableSqft: buildable.buildableSqft,
      buildableFootprintSqm: buildable.buildableFootprintSqm,
      constraintNotes: buildable.constraintNotes,
    },
    proForma: {
      constructionCost: proForma.constructionCost,
      totalProjectCost: proForma.totalProjectCost,
      grossPotentialIncomeAnnual: proForma.grossPotentialIncomeAnnual,
      perUnitMonthlyRent: proForma.perUnitMonthlyRent,
      noi: proForma.noi,
      capRate: proForma.capRate,
      cashOnCashRoi: proForma.cashOnCashRoi,
    },
    meetsThreshold: result.meetsThreshold,
  };
}

/**
 * forterahomes' own entry point: runs the same scrape -> extract -> zone
 * match -> pro forma pipeline mls-scraper runs (ported into ../lib), then
 * persists straight into forterahomes' own D1 via the existing
 * /api/property-finder/ingest endpoint. No database client lives in this
 * project at all — the ingest endpoint already handles the upsert.
 */
export async function runDailyPipeline(): Promise<AnalysisResult[]> {
  const options = await fetchPipelineSettings();
  const results = await generateDailyReport(options);

  const baseUrl = process.env.PROPERTY_FINDER_BASE_URL;
  const ingestKey = process.env.PROPERTY_FINDER_INGEST_KEY;
  if (!baseUrl || !ingestKey) {
    console.warn("[dailyPipeline] PROPERTY_FINDER_BASE_URL/PROPERTY_FINDER_INGEST_KEY not set — skipping ingest push.");
    return results;
  }
  if (results.length === 0) {
    console.log("[dailyPipeline] No results to push.");
    return results;
  }

  const res = await fetch(`${baseUrl}/api/property-finder/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-property-finder-ingest-key": ingestKey,
    },
    body: JSON.stringify({
      runDate: new Date().toISOString(),
      results: results.map(toIngestResult),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ingest push failed: HTTP ${res.status} ${body}`);
  }

  const summary = (await res.json()) as { inserted: number; updated: number; runsCreated: number; errors: unknown[] };
  console.log(
    `[dailyPipeline] inserted=${summary.inserted} updated=${summary.updated} runsCreated=${summary.runsCreated} errors=${summary.errors.length}`
  );

  return results;
}
