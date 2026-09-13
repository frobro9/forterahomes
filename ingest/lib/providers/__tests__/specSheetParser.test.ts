import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ParsedEmail, SpecSheetListing } from "../specSheetParser";

const { discoverOneHomeListingUrls, scrapeOneHomeListings } = vi.hoisted(() => ({
  discoverOneHomeListingUrls: vi.fn(),
  scrapeOneHomeListings: vi.fn(),
}));

vi.mock("../oneHomePortal", async () => {
  const actual = await vi.importActual<typeof import("../oneHomePortal")>("../oneHomePortal");
  return {
    ...actual,
    discoverOneHomeListingUrls,
    scrapeOneHomeListings,
  };
});

import { OneHomePortalSpecSheetParser } from "../specSheetParser";
import { extractOneHomePropertyKey } from "../oneHomePortal";

function email(subject: string): ParsedEmail {
  return {
    subject,
    html: `<a href="https://portal.onehome.com/en-CA/search?searchId=abc">link</a>`,
    text: null,
    attachmentPdfTexts: [],
    receivedAt: new Date("2026-08-26"),
  };
}

const stubListing = (id: string): SpecSheetListing => ({
  providerListingId: id,
  address: `${id} Test St`,
  neighborhood: "",
  listPrice: 800000,
  lotWidthM: null,
  lotDepthM: null,
  lotAreaSqm: null,
  buildingSqft: null,
  yearBuilt: null,
  propertyType: "Detached",
  status: "active",
  raw: {},
});

describe("extractOneHomePropertyKey", () => {
  it("extracts the same key for the same property across different session query params", () => {
    const a = "https://portal.onehome.com/en-CA/property/aotf~1183078787~TRREB?token=t1&searchId=s1";
    const b = "https://portal.onehome.com/en-CA/property/aotf~1183078787~TRREB?token=t2&searchId=s2";
    expect(extractOneHomePropertyKey(a)).toBe(extractOneHomePropertyKey(b));
  });

  it("extracts different keys for different properties", () => {
    const a = "https://portal.onehome.com/en-CA/property/aotf~1183078787~TRREB?token=t1";
    const b = "https://portal.onehome.com/en-CA/property/aotf~1176403391~TRREB?token=t1";
    expect(extractOneHomePropertyKey(a)).not.toBe(extractOneHomePropertyKey(b));
  });
});

describe("OneHomePortalSpecSheetParser", () => {
  beforeEach(() => {
    discoverOneHomeListingUrls.mockReset();
    scrapeOneHomeListings.mockReset();
  });

  it("only scrapes+extracts a listing once across multiple emails that both reference it this run", async () => {
    const urlA = "https://portal.onehome.com/en-CA/property/aotf~111~TRREB?searchId=s1";
    const urlB = "https://portal.onehome.com/en-CA/property/aotf~222~TRREB?searchId=s1";
    // Second email's overlapping search results: same property 111 (different
    // session query string) plus one genuinely new property, 333.
    const urlA2 = "https://portal.onehome.com/en-CA/property/aotf~111~TRREB?searchId=s2";
    const urlC = "https://portal.onehome.com/en-CA/property/aotf~333~TRREB?searchId=s2";

    discoverOneHomeListingUrls
      .mockResolvedValueOnce([urlA, urlB])
      .mockResolvedValueOnce([urlA2, urlC]);
    scrapeOneHomeListings
      .mockResolvedValueOnce([stubListing("111"), stubListing("222")])
      .mockResolvedValueOnce([stubListing("333")]);

    const parser = new OneHomePortalSpecSheetParser();

    const first = await parser.parse(email("Day 1 digest"));
    expect(scrapeOneHomeListings).toHaveBeenNthCalledWith(1, [urlA, urlB]);
    expect(first).toHaveLength(2);

    const second = await parser.parse(email("Day 2 digest"));
    // Property 111 was already scraped on the first call — only the
    // genuinely new URL (333) should be passed to the expensive step.
    expect(scrapeOneHomeListings).toHaveBeenNthCalledWith(2, [urlC]);
    expect(second).toHaveLength(1);
  });

  it("skips a listing already known from a previous run before ever scraping or extracting it", async () => {
    const knownUrl = "https://portal.onehome.com/en-CA/property/aotf~999~TRREB?searchId=old";
    const newUrl = "https://portal.onehome.com/en-CA/property/aotf~444~TRREB?searchId=s1";
    // Same property (999) as knownUrl, but with a different session query
    // string, plus one genuinely new property (444).
    const seenAgainUrl = "https://portal.onehome.com/en-CA/property/aotf~999~TRREB?searchId=s1";

    discoverOneHomeListingUrls.mockResolvedValueOnce([seenAgainUrl, newUrl]);
    scrapeOneHomeListings.mockResolvedValueOnce([stubListing("444")]);

    const getKnownPropertyKeys = vi.fn(async () => [extractOneHomePropertyKey(knownUrl)]);
    const parser = new OneHomePortalSpecSheetParser(getKnownPropertyKeys);

    const result = await parser.parse(email("Day 3 digest"));

    expect(getKnownPropertyKeys).toHaveBeenCalledTimes(1);
    // Property 999 is already known from a previous run — only the
    // genuinely new URL should ever reach the expensive scrape+extract step.
    expect(scrapeOneHomeListings).toHaveBeenCalledWith([newUrl]);
    expect(result).toHaveLength(1);
  });

  it("only loads known property keys once, even across multiple parse() calls", async () => {
    discoverOneHomeListingUrls.mockResolvedValue([]);
    scrapeOneHomeListings.mockResolvedValue([]);

    const getKnownPropertyKeys = vi.fn(async () => []);
    const parser = new OneHomePortalSpecSheetParser(getKnownPropertyKeys);

    await parser.parse(email("Day 1"));
    await parser.parse(email("Day 2"));

    expect(getKnownPropertyKeys).toHaveBeenCalledTimes(1);
  });

  it("returns no listings, without throwing, when a saved search currently has zero matches", async () => {
    discoverOneHomeListingUrls.mockResolvedValueOnce([]);
    scrapeOneHomeListings.mockResolvedValueOnce([]);

    const parser = new OneHomePortalSpecSheetParser();
    const result = await parser.parse(email("Empty saved search"));

    expect(result).toEqual([]);
    expect(scrapeOneHomeListings).toHaveBeenCalledWith([]);
  });

  it("skips just the failing email's link (instead of throwing) when discovery genuinely fails", async () => {
    const urlA = "https://portal.onehome.com/en-CA/property/aotf~111~TRREB?searchId=s1";

    discoverOneHomeListingUrls
      .mockRejectedValueOnce(new Error("net::ERR_CONNECTION_RESET"))
      .mockResolvedValueOnce([urlA]);
    scrapeOneHomeListings.mockResolvedValueOnce([stubListing("111")]);

    const parser = new OneHomePortalSpecSheetParser();

    const first = await parser.parse(email("Day 1 digest (fails to load)"));
    expect(first).toEqual([]);

    // A later email's link should still be processed normally — one
    // failure shouldn't poison the whole run.
    const second = await parser.parse(email("Day 2 digest"));
    expect(second).toHaveLength(1);
  });
});
