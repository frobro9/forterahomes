import { readFileSync } from "fs";
import { ListingsProvider, RawListing } from "./types";

// Minimal CSV parser sufficient for our fixed, comma-separated, no-embedded-
// comma sample data. Swap for a real CSV library if richer input is needed.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").filter((l) => l.trim().length > 0);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}

function toRawListing(row: Record<string, string>): RawListing {
  return {
    provider: "csv",
    providerListingId: row.providerListingId,
    address: row.address,
    neighborhood: row.neighborhood,
    lat: row.lat ? Number(row.lat) : null,
    lng: row.lng ? Number(row.lng) : null,
    listPrice: Number(row.listPrice),
    lotWidthM: Number(row.lotWidthM),
    lotDepthM: Number(row.lotDepthM),
    lotAreaSqm: Number(row.lotAreaSqm),
    buildingSqft: row.buildingSqft ? Number(row.buildingSqft) : null,
    yearBuilt: row.yearBuilt ? Number(row.yearBuilt) : null,
    propertyType: row.propertyType,
    status: row.status || "active",
    zoneCode: row.zoneCode,
    raw: row,
  };
}

/**
 * Development/Phase-1 provider: reads a fixed CSV of manually curated
 * listings so the zoning + finance engines and dashboard can be built and
 * tested without a live feed. `since` is ignored — the file has no
 * per-listing timestamps, so every row is returned on every call.
 */
export class CsvListingsProvider implements ListingsProvider {
  name = "csv";

  constructor(private readonly filePath: string) {}

  async fetchNewOrUpdatedListings(): Promise<RawListing[]> {
    const text = readFileSync(this.filePath, "utf-8");
    return parseCsv(text).map(toRawListing);
  }
}
