import path from "path";
import { describe, expect, it } from "vitest";
import { CsvListingsProvider } from "../csvProvider";
import { getZoneProvisions } from "../../zoning/zoneReference";
import { OTTAWA_RENT_TABLE } from "../../finance/rentEstimate";

describe("CsvListingsProvider", () => {
  const csvPath = path.join(process.cwd(), "data", "sample-listings.csv");
  const provider = new CsvListingsProvider(csvPath);

  it("parses every row into a well-formed RawListing", async () => {
    const listings = await provider.fetchNewOrUpdatedListings();
    expect(listings.length).toBeGreaterThan(0);
    for (const listing of listings) {
      expect(listing.providerListingId).toBeTruthy();
      expect(listing.listPrice).toBeGreaterThan(0);
      expect(listing.lotAreaSqm).toBeGreaterThan(0);
    }
  });

  it("references zone codes and neighborhoods that exist in the reference tables", async () => {
    const listings = await provider.fetchNewOrUpdatedListings();
    const neighborhoods = new Set(
      OTTAWA_RENT_TABLE.map((r) => r.neighborhood)
    );
    for (const listing of listings) {
      expect(listing.zoneCode).toBeTruthy();
      expect(getZoneProvisions(listing.zoneCode!)).toBeDefined();
      expect(neighborhoods.has(listing.neighborhood)).toBe(true);
    }
  });
});
