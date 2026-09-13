export interface RawListing {
  provider: string;
  providerListingId: string;
  address: string;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
  listPrice: number;
  lotWidthM: number;
  lotDepthM: number;
  lotAreaSqm: number;
  buildingSqft: number | null;
  yearBuilt: number | null;
  propertyType: string;
  status: string;
  /**
   * Manually known zone code, if any. Optional because providers driven by
   * lat/lng (e.g. the email/spec-sheet provider) rely entirely on
   * LiveGisMatcher to resolve the zone instead of supplying one directly.
   */
  zoneCode?: string;
  raw: Record<string, unknown>;
}

export interface ListingsProvider {
  name: string;
  fetchNewOrUpdatedListings(since: Date): Promise<RawListing[]>;
}
