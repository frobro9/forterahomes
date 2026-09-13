import {
  extractOneHomeLink,
  extractOneHomePropertyKey,
  discoverOneHomeListingUrls,
  scrapeOneHomeListings,
} from "./oneHomePortal";

export interface ParsedEmail {
  subject: string;
  html: string | null;
  text: string | null;
  /** Extracted text of any PDF attachments (spec sheets are often a PDF, not inline HTML). */
  attachmentPdfTexts: string[];
  receivedAt: Date;
}

export interface SpecSheetListing {
  providerListingId: string;
  address: string;
  neighborhood: string;
  listPrice: number;
  lotWidthM: number | null;
  lotDepthM: number | null;
  lotAreaSqm: number | null;
  buildingSqft: number | null;
  yearBuilt: number | null;
  propertyType: string;
  status: string;
  raw: Record<string, unknown>;
}

export interface SpecSheetParser {
  parse(email: ParsedEmail): Promise<SpecSheetListing[]>;
}

/**
 * Placeholder for emails that don't match any known spec-sheet format.
 * Every such email is skipped (with a one-time warning) rather than
 * throwing, so an unexpected email in the mailbox doesn't take down the
 * whole ingest run.
 */
export class UnconfiguredSpecSheetParser implements SpecSheetParser {
  private warned = false;

  async parse(): Promise<SpecSheetListing[]> {
    if (!this.warned) {
      console.warn(
        "[emailProvider] No spec-sheet format matched this email — see lib/providers/specSheetParser.ts."
      );
      this.warned = true;
    }
    return [];
  }
}

/**
 * The realtor's actual auto-email format: a OneHome/TRREB client-portal
 * notification linking to a JS-rendered results page, not inline
 * HTML/PDF spec-sheet data. Follows that link and scrapes every listing
 * (lib/providers/oneHomePortal.ts), using a Claude extraction step
 * (lib/providers/oneHomeExtractor.ts) instead of hand-written field
 * regexes to stay robust across listing types and portal layout drift.
 */
export class OneHomePortalSpecSheetParser implements SpecSheetParser {
  private warnedNoLink = false;
  private knownKeysLoaded = false;

  // Persists for the lifetime of this parser instance — i.e. for one
  // fetchNewOrUpdatedListings() run (lib/providers/index.ts constructs a
  // fresh parser per ingest run, so this always starts empty other than
  // whatever getKnownPropertyKeys seeds it with below). The 7-day email
  // lookback window means several days' notification emails typically
  // link to overlapping sets of still-active listings — without this, the
  // same property gets rescraped and re-sent through Claude extraction
  // once per email that happens to mention it, which both burns tokens on
  // listings already analyzed this run and (at high enough duplication)
  // floods the City's live zoning GIS service with enough concurrent
  // requests to start failing outright.
  private seenPropertyKeys = new Set<string>();

  /**
   * @param getKnownPropertyKeys Optionally supplies the OneHome property
   *   keys of listings already persisted from a PREVIOUS run (see
   *   lib/providers/index.ts, which derives these from each stored
   *   listing's rawPayload.detailUrl) — seeded into seenPropertyKeys
   *   before the first parse() so an already-tracked property is skipped
   *   before it's ever scraped or sent through Claude extraction, not
   *   just cleaned up afterward by the DB-level duplicate guard in
   *   jobs/dailyPipeline.ts. Optional (and never called) so this parser
   *   still works standalone, e.g. in dev scripts with no DB.
   */
  constructor(private readonly getKnownPropertyKeys?: () => Promise<Iterable<string>>) {}

  async parse(email: ParsedEmail): Promise<SpecSheetListing[]> {
    if (!this.knownKeysLoaded) {
      if (this.getKnownPropertyKeys) {
        for (const key of await this.getKnownPropertyKeys()) {
          this.seenPropertyKeys.add(key);
        }
      }
      this.knownKeysLoaded = true;
    }

    const link = email.html ? extractOneHomeLink(email.html) : null;
    if (!link) {
      if (!this.warnedNoLink) {
        console.warn(
          `[OneHomePortalSpecSheetParser] No OneHome portal link found in email "${email.subject}" — skipping.`
        );
        this.warnedNoLink = true;
      }
      return [];
    }

    let allUrls: string[];
    try {
      allUrls = await discoverOneHomeListingUrls(link);
    } catch (err) {
      // A genuine failure to load/render one email's portal link (network
      // error, Playwright crash, layout drift breaking the link locator)
      // shouldn't take down the whole ingest run and discard every listing
      // already scraped from other emails this run — log and skip just
      // this email's link, same as scrapeOneHomeListings isolates a single
      // bad listing page below.
      console.warn(
        `[OneHomePortalSpecSheetParser] Failed to discover listings from "${email.subject}" (${link}): ${(err as Error).message}`
      );
      return [];
    }

    const newUrls = allUrls.filter((url) => {
      const key = extractOneHomePropertyKey(url);
      if (this.seenPropertyKeys.has(key)) return false;
      this.seenPropertyKeys.add(key);
      return true;
    });

    const alreadySeen = allUrls.length - newUrls.length;
    if (alreadySeen > 0) {
      console.log(
        `[OneHomePortalSpecSheetParser] Skipping ${alreadySeen} listing(s) from "${email.subject}" already known (persisted from an earlier run, or scraped earlier this one).`
      );
    }

    return scrapeOneHomeListings(newUrls);
  }
}
