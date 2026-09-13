import { getListingsProvider } from "../providers";
import { RawListing } from "../providers/types";
import { mapWithConcurrency } from "../concurrency";
import { computeBuildablePotential, LotDimensions } from "../zoning/rulesEngine";
import { getZoneProvisions } from "../zoning/zoneReference";
import { OverlayFlags } from "../zoning/overlays";
import { GisMatcher, LiveGisMatcher, StubGisMatcher } from "../zoning/gisMatch";
import { computeProForma } from "../finance/proForma";
import { FinancialAssumptions, mergeAssumptions } from "../finance/assumptions";
import { SeededRentEstimateProvider } from "../finance/rentEstimate";
import { rankOpportunities } from "../scoring/rankOpportunities";
import { AnalysisResult, DEFAULT_THRESHOLDS, OpportunityThresholds } from "./types";

export interface GenerateReportOptions {
  assumptions?: Partial<FinancialAssumptions>;
  thresholds?: Partial<OpportunityThresholds>;
  overlaysByListingId?: Record<string, OverlayFlags>;
  targetNeighborhoods?: string[];
  priceMin?: number;
  priceMax?: number;
}

const rentProvider = new SeededRentEstimateProvider();

// Each listing's zone match fires up to 3 concurrent requests to the City
// of Ottawa's live GIS layers (zoning, floodplain, heritage). Uncapped
// concurrency across a large batch (observed: ~190 listings -> 500+
// simultaneous requests) overwhelms that free public service, which
// silently degrades to empty results rather than erroring — dropping the
// listing entirely, after the (expensive) scrape + Claude extraction that
// produced it has already been paid for. Capped low enough to stay well
// under whatever the service can actually sustain.
const GIS_MATCH_CONCURRENCY = 5;

// USE_LIVE_GIS=true resolves each listing's zone from the City of Ottawa's
// live zoning service by lat/lng instead of the listing's manually supplied
// zoneCode. Off by default so CSV-driven dev/test runs stay network-free.
function getGisMatcher(): GisMatcher {
  return process.env.USE_LIVE_GIS === "true" ? new LiveGisMatcher() : new StubGisMatcher();
}

/**
 * Runs the ingest -> zone match -> buildable potential -> pro forma ->
 * ranking pipeline in-memory and returns the results. This is the function
 * both the dashboard (Phase 1, no DB required) and the persisted daily
 * pipeline (jobs/dailyPipeline.ts, Phase 2) build on.
 */
export async function generateDailyReport(
  options: GenerateReportOptions = {}
): Promise<AnalysisResult[]> {
  const assumptions = mergeAssumptions(options.assumptions ?? {});
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
  const gisMatcher = getGisMatcher();

  const provider = getListingsProvider();
  // "Since epoch" would work for the CSV provider (which ignores `since`
  // entirely) but is wrong for a real IMAP mailbox with years of unrelated
  // history — a daily job only needs a recent window.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let listings = await provider.fetchNewOrUpdatedListings(since);

  if (options.targetNeighborhoods && options.targetNeighborhoods.length > 0) {
    const wanted = new Set(options.targetNeighborhoods);
    listings = listings.filter((l) => wanted.has(l.neighborhood));
  }

  if (options.priceMin != null) {
    listings = listings.filter((l) => l.listPrice >= options.priceMin!);
  }
  if (options.priceMax != null) {
    listings = listings.filter((l) => l.listPrice <= options.priceMax!);
  }

  const results = await mapWithConcurrency(listings, GIS_MATCH_CONCURRENCY, (listing) =>
    analyzeListing(
      listing,
      assumptions,
      thresholds,
      options.overlaysByListingId?.[listing.providerListingId] ?? {},
      gisMatcher
    )
  );

  return rankOpportunities(results.filter((r): r is AnalysisResult => r !== null));
}

async function analyzeListing(
  listing: RawListing,
  assumptions: FinancialAssumptions,
  thresholds: OpportunityThresholds,
  manualOverlays: OverlayFlags,
  gisMatcher: GisMatcher
): Promise<AnalysisResult | null> {
  let zoneCode = listing.zoneCode;
  let overlays = manualOverlays;
  let zoneSource: AnalysisResult["zoneSource"] = "manual";
  let rawZoneCode: string | undefined;
  let subZoneCode: string | undefined;
  let heightOverrideM: number | null | undefined;

  if (listing.lat != null && listing.lng != null) {
    // A network hiccup reaching the City of Ottawa's GIS service shouldn't
    // take down the whole batch (this sits inside a Promise.all across all
    // listings) — skip just this listing's zone match and fall through to
    // the "no zone code" branch below, same as any other unmatched listing.
    try {
      const match = await gisMatcher.matchParcel(listing.lat, listing.lng, listing.address);
      if (match) {
        zoneCode = match.zoneCode;
        rawZoneCode = match.rawZoneCode;
        subZoneCode = match.subZoneCode ?? undefined;
        heightOverrideM = match.heightOverrideM;
        overlays = { ...match.overlays, ...manualOverlays };
        zoneSource = "live-gis";
      }
    } catch (err) {
      console.warn(
        `Live GIS match failed for listing ${listing.providerListingId}: ${(err as Error).message}`
      );
    }
  }

  if (!zoneCode) {
    console.warn(
      `Skipping listing ${listing.providerListingId}: no zone code available (no live GIS match and no manually supplied zoneCode)`
    );
    return null;
  }

  const zone = getZoneProvisions(zoneCode);
  if (!zone) {
    console.warn(
      `Skipping listing ${listing.providerListingId}: unknown zone code "${zoneCode}"`
    );
    return null;
  }

  const lot: LotDimensions = {
    lotWidthM: listing.lotWidthM,
    lotDepthM: listing.lotDepthM,
    lotAreaSqm: listing.lotAreaSqm,
  };
  const buildable = computeBuildablePotential(zone, lot, overlays, heightOverrideM);

  const monthlyRentPerSqft = rentProvider.estimateMonthlyRentPerSqft(
    listing.neighborhood
  );

  const proForma = computeProForma({
    listPrice: listing.listPrice,
    buildableSqft: buildable.buildableSqft,
    unitCount: buildable.maxUnits,
    avgUnitSqft: buildable.unitMixSuggestion.avgUnitSqft,
    monthlyRentPerSqft,
    assumptions,
  });

  const meetsThreshold =
    proForma.capRate >= thresholds.minCapRate &&
    proForma.cashOnCashRoi >= thresholds.minCashOnCashRoi;

  return { listing, zone, buildable, proForma, meetsThreshold, zoneSource, rawZoneCode, subZoneCode };
}
