import { RawListing } from "../providers/types";

export type ListingChangeType = "new" | "changed" | "unchanged";

export interface ListingChange {
  listing: RawListing;
  changeType: ListingChangeType;
}

/**
 * Compares freshly fetched listings against a snapshot of previously seen
 * listings (keyed by provider + providerListingId) to distinguish brand-new
 * listings from price/status changes on ones already seen. Both cases
 * trigger re-analysis in the daily pipeline; only "new" listings need a
 * first-seen timestamp write.
 */
export function detectChanges(
  freshListings: RawListing[],
  previousListings: Map<string, RawListing>
): ListingChange[] {
  return freshListings.map((listing) => {
    const key = `${listing.provider}:${listing.providerListingId}`;
    const previous = previousListings.get(key);

    if (!previous) {
      return { listing, changeType: "new" };
    }
    if (
      previous.listPrice !== listing.listPrice ||
      previous.status !== listing.status
    ) {
      return { listing, changeType: "changed" };
    }
    return { listing, changeType: "unchanged" };
  });
}
