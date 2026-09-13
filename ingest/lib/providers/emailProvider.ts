import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { ListingsProvider, RawListing } from "./types";
import { ParsedEmail, SpecSheetListing, SpecSheetParser, UnconfiguredSpecSheetParser } from "./specSheetParser";
import { geocodeAddress } from "../geocode/ottawaGeocoder";
import { matchNeighbourhood } from "../geocode/neighbourhoodMatch";

export interface EmailProviderConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  /** Only process emails from this address (the realtor's forwarding address). Optional. */
  fromFilter?: string;
}

/**
 * Reads spec-sheet emails from a mailbox (fed by a realtor's MLS
 * client-portal auto-email/drip feature — a legitimate, licensed source,
 * unlike scraping a public listings site) and turns them into RawListings.
 *
 * Field extraction (`SpecSheetParser`) is intentionally pluggable: it's
 * unconfigured until built against a real sample email, see
 * lib/providers/specSheetParser.ts.
 */
export class EmailListingsProvider implements ListingsProvider {
  name = "email";

  constructor(
    private readonly config: EmailProviderConfig,
    private readonly parser: SpecSheetParser = new UnconfiguredSpecSheetParser()
  ) {}

  async fetchNewOrUpdatedListings(since: Date): Promise<RawListing[]> {
    // Fetching/parsing emails is fast; parsing a spec sheet (OneHome scrape
    // + Claude call) can take minutes across many listings. Doing that slow
    // work while the IMAP connection sits open risks the socket timing out
    // mid-scrape (observed: ImapFlow emits an unhandled 'error' on socket
    // timeout, which crashes the process since nothing listens for it) — so
    // the IMAP session is fully drained and closed first, and only cheap
    // ParsedEmail objects are kept around for the slow parsing phase after.
    const emails = await this.fetchMatchingEmails(since);

    const specSheetListings: SpecSheetListing[] = [];
    for (const email of emails) {
      specSheetListings.push(...(await this.parser.parse(email)));
    }

    const rawListings: RawListing[] = [];
    for (const listing of specSheetListings) {
      const geocoded = await geocodeAddress(listing.address);

      // The spec-sheet parser never extracts a neighborhood (OneHome's
      // listing page doesn't reliably state one) — resolve it from the
      // geocoded point instead, via the same live-GIS point-in-polygon
      // pattern already used for zoning. A lookup failure shouldn't take
      // down the whole batch, so it's caught and just left blank.
      let neighborhood = listing.neighborhood;
      if (geocoded) {
        try {
          const matched = await matchNeighbourhood(geocoded.lat, geocoded.lng);
          if (matched) neighborhood = matched;
        } catch (err) {
          console.warn(
            `[emailProvider] Neighbourhood match failed for "${listing.address}": ${(err as Error).message}`
          );
        }
      }

      rawListings.push({
        provider: this.name,
        providerListingId: listing.providerListingId,
        address: listing.address,
        neighborhood,
        lat: geocoded?.lat ?? null,
        lng: geocoded?.lng ?? null,
        listPrice: listing.listPrice,
        lotWidthM: listing.lotWidthM ?? 0,
        lotDepthM: listing.lotDepthM ?? 0,
        lotAreaSqm: listing.lotAreaSqm ?? 0,
        buildingSqft: listing.buildingSqft,
        yearBuilt: listing.yearBuilt,
        propertyType: listing.propertyType,
        status: listing.status,
        // No manual zoneCode — resolved entirely via LiveGisMatcher from lat/lng.
        // rawPayload.neighborhood is what the persisted-data queries
        // (lib/db/queries.ts) actually read back on reload — see
        // lib/db/upsertListing.ts for why rawPayload is what's persisted.
        raw: { ...listing.raw, neighborhood },
      });
    }

    return rawListings;
  }

  private async fetchMatchingEmails(since: Date): Promise<ParsedEmail[]> {
    const client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: { user: this.config.user, pass: this.config.password },
      logger: false,
    });
    // Without a listener, ImapFlow's default EventEmitter behavior on a
    // socket-level error is to throw and crash the process — log instead.
    client.on("error", (err) => console.warn(`[emailProvider] IMAP connection error: ${err.message}`));

    await client.connect();
    const emails: ParsedEmail[] = [];

    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const uids = await client.search({ since });
        if (uids && uids.length > 0) {
          for await (const message of client.fetch(uids, { source: true, envelope: true })) {
            if (!message.source) continue;
            if (
              this.config.fromFilter &&
              !message.envelope?.from?.some((f) =>
                f.address?.toLowerCase().includes(this.config.fromFilter!.toLowerCase())
              )
            ) {
              continue;
            }

            const parsed = await simpleParser(message.source);
            // PDF attachments aren't parsed: the realtor's actual spec-sheet
            // format links to a portal (see oneHomePortal.ts) rather than
            // attaching a PDF, so this has never been exercised against a
            // real sample. A prior pdf-parse-based attempt also pulled in
            // pdfjs's DOMMatrix/canvas polyfill, which crashes in Vercel's
            // serverless runtime — not worth carrying for an unused path.
            const pdfTexts: string[] = [];
            for (const attachment of parsed.attachments) {
              if (attachment.contentType === "application/pdf") {
                console.warn(
                  `[emailProvider] PDF attachment "${attachment.filename}" on "${parsed.subject}" was not parsed — no PDF-based spec-sheet parser is implemented yet.`
                );
              }
            }

            emails.push({
              subject: parsed.subject ?? "",
              html: typeof parsed.html === "string" ? parsed.html : null,
              text: parsed.text ?? null,
              attachmentPdfTexts: pdfTexts,
              receivedAt: parsed.date ?? new Date(),
            });
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      // A dead/stale connection here shouldn't discard already-fetched
      // emails — logout is best-effort cleanup, not part of the result.
      try {
        await client.logout();
      } catch (err) {
        console.warn(`[emailProvider] IMAP logout failed (connection likely already closed): ${(err as Error).message}`);
      }
    }

    return emails;
  }
}
