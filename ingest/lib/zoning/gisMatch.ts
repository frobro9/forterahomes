import { LotDimensions } from "./rulesEngine";
import { OverlayFlags } from "./overlays";

export interface ParcelMatch {
  zoneCode: string;
  rawZoneCode: string;
  /** e.g. "N4B" — base zone + subzone letter, from the ZN layer's
   * Z_SUBZONES2 field. Null if the layer didn't return one. */
  subZoneCode: string | null;
  /** Site-specific height limit in metres, parsed from an "H(##)" suffix
   * in rawZoneCode (e.g. "N4B H(11)" -> 11) — overrides the zone
   * reference table's generic base-zone height when present. Null if
   * rawZoneCode has no such suffix. */
  heightOverrideM: number | null;
  lot: LotDimensions | null;
  overlays: OverlayFlags;
  municipalAddress: string;
}

export interface GisMatcher {
  matchParcel(lat: number, lng: number, address: string): Promise<ParcelMatch | null>;
}

/** No live GIS call — callers fall back to a manually supplied zone code. */
export class StubGisMatcher implements GisMatcher {
  async matchParcel(): Promise<ParcelMatch | null> {
    return null;
  }
}

const ZONING_LAYER =
  "https://maps.ottawa.ca/arcgis/rest/services/Zoning_Bylaw_2026_50/MapServer/5/query";
const FLOODPLAIN_LAYER =
  "https://maps.ottawa.ca/arcgis/rest/services/Zoning_Bylaw_2026_50/MapServer/1/query";
// Heritage overlay is maintained on the general Zoning service and shared
// across bylaw versions (heritage districts don't change with a rezoning).
const HERITAGE_LAYER = "https://maps.ottawa.ca/arcgis/rest/services/Zoning/MapServer/1/query";

/**
 * Real zone codes from the live service look like "N4B[2249] H(11)-c" —
 * a base zone (N4), a subzone letter (B), an optional bracketed
 * site-specific exception number, and optional height/other suffixes.
 * Our zone reference table (zoneReference.ts) is keyed at the base-zone
 * level only; subzone- and exception-specific provisions still require
 * manual lookup against the bylaw text.
 */
export function parseBaseZoneCode(rawZoneCode: string): string {
  const match = rawZoneCode.trim().match(/^[A-Z]+[0-9]*/);
  return match ? match[0] : rawZoneCode.trim();
}

/**
 * Extracts a site-specific height override in metres from a raw zone code
 * like "N4B H(11)" or "N4B[2249] H(11)-c" — the bylaw text overrides the
 * zone's generic base-zone height for that specific parcel. Returns null
 * if the code has no "H(##)" suffix.
 */
export function parseHeightOverrideM(rawZoneCode: string): number | null {
  const match = rawZoneCode.match(/H\((\d+(?:\.\d+)?)\)/);
  return match ? Number(match[1]) : null;
}

async function queryPointIntersects(
  layerUrl: string,
  lat: number,
  lng: number,
  outFields: string
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "false",
    f: "json",
  });

  const response = await fetch(`${layerUrl}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`GIS query failed (${response.status}): ${layerUrl}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`GIS query error: ${JSON.stringify(data.error)}`);
  }
  return (data.features ?? []).map((f: { attributes: Record<string, unknown> }) => f.attributes);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Queries the City of Ottawa's live zoning GIS services by lat/lng
 * (point-in-polygon via ArcGIS's own spatial query, so no local geometry
 * math is needed). Does not resolve lot width/depth/area — that isn't
 * available from these layers and continues to come from the listing data
 * itself, as in Phase 1.
 */
export class LiveGisMatcher implements GisMatcher {
  async matchParcel(lat: number, lng: number, address: string): Promise<ParcelMatch | null> {
    // Under enough concurrent load, the zoning layer has been observed to
    // come back with a 200 OK and zero features for a parcel that's
    // genuinely zoned (confirmed by the same address resolving fine
    // outside a large batch) — a degraded response rather than an error,
    // so queryPointIntersects's own error handling doesn't catch it. A
    // few short-delayed retries on an empty zoning result, on top of the
    // concurrency cap in lib/reports/generateDailyReport.ts, gives an
    // affected listing a chance to succeed instead of being dropped
    // outright after its (already-paid-for) scrape + Claude extraction.
    let zoningFeatures: Record<string, unknown>[] = [];
    let floodplainFeatures: Record<string, unknown>[] = [];
    let heritageFeatures: Record<string, unknown>[] = [];
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      [zoningFeatures, floodplainFeatures, heritageFeatures] = await Promise.all([
        queryPointIntersects(ZONING_LAYER, lat, lng, "ZN_CODE2,Z_SUBZONES2,ZNAME_EN,ZGROUP_EN"),
        queryPointIntersects(FLOODPLAIN_LAYER, lat, lng, "OBJECTID"),
        queryPointIntersects(HERITAGE_LAYER, lat, lng, "OBJECTID"),
      ]);
      if (zoningFeatures.length > 0 || attempt === MAX_ATTEMPTS) break;
      await sleep(500 * attempt);
    }

    const zoningMatch = zoningFeatures[0];
    if (!zoningMatch || typeof zoningMatch.ZN_CODE2 !== "string") {
      return null;
    }

    const rawZoneCode = zoningMatch.ZN_CODE2;

    return {
      zoneCode: parseBaseZoneCode(rawZoneCode),
      rawZoneCode,
      subZoneCode: typeof zoningMatch.Z_SUBZONES2 === "string" ? zoningMatch.Z_SUBZONES2 : null,
      heightOverrideM: parseHeightOverrideM(rawZoneCode),
      lot: null,
      overlays: {
        floodplain: floodplainFeatures.length > 0,
        heritage: heritageFeatures.length > 0,
      },
      municipalAddress: address,
    };
  }
}
