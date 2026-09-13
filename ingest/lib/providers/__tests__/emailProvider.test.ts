import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpecSheetListing, SpecSheetParser } from "../specSheetParser";

const mockFetchMessage = {
  source: Buffer.from("raw-email-bytes"),
  envelope: { from: [{ address: "listings@myrealtor.example" }] },
};

const connect = vi.fn();
const logout = vi.fn();
const release = vi.fn();
const getMailboxLock = vi.fn(async () => ({ release }));
const search = vi.fn(async () => [1]);
const on = vi.fn();
async function* fetchGenerator() {
  yield mockFetchMessage;
}
const fetch = vi.fn(() => fetchGenerator());

vi.mock("imapflow", () => ({
  // A regular function (not arrow) so it's usable as a constructor —
  // returning an object from it overrides what `new` produces.
  ImapFlow: vi.fn().mockImplementation(function () {
    return { connect, logout, getMailboxLock, search, fetch, on };
  }),
}));

vi.mock("mailparser", () => ({
  simpleParser: vi.fn(async () => ({
    subject: "New listing",
    html: "<p>123 Bank St</p>",
    text: "123 Bank St",
    date: new Date("2026-08-14"),
    attachments: [],
  })),
}));

vi.mock("../../geocode/ottawaGeocoder", () => ({
  geocodeAddress: vi.fn(async (address: string) => ({
    lat: 45.41,
    lng: -75.69,
    score: 100,
    matchedAddress: address,
  })),
}));

import { EmailListingsProvider } from "../emailProvider";
import { geocodeAddress } from "../../geocode/ottawaGeocoder";

const baseConfig = {
  host: "imap.example.com",
  port: 993,
  secure: true,
  user: "user@example.com",
  password: "app-password",
};

describe("EmailListingsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search.mockResolvedValue([1]);
    fetch.mockReturnValue(fetchGenerator());
  });

  it("connects, reads the mailbox, and logs out even with the default (unconfigured) parser", async () => {
    const provider = new EmailListingsProvider(baseConfig);
    const results = await provider.fetchNewOrUpdatedListings(new Date(0));

    expect(connect).toHaveBeenCalled();
    expect(logout).toHaveBeenCalled();
    expect(results).toEqual([]); // UnconfiguredSpecSheetParser yields nothing
  });

  it("returns no messages, and skips IMAP fetch, when search finds none", async () => {
    search.mockResolvedValue([]);
    const provider = new EmailListingsProvider(baseConfig);
    const results = await provider.fetchNewOrUpdatedListings(new Date(0));

    expect(fetch).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });

  it("converts parsed spec-sheet listings into geocoded RawListings", async () => {
    const stubListing: SpecSheetListing = {
      providerListingId: "SPEC-1",
      address: "123 Bank St",
      neighborhood: "Centretown",
      listPrice: 850000,
      lotWidthM: 15,
      lotDepthM: 30,
      lotAreaSqm: 450,
      buildingSqft: 1800,
      yearBuilt: 1920,
      propertyType: "Detached",
      status: "active",
      raw: {},
    };
    const parser: SpecSheetParser = { parse: vi.fn(async () => [stubListing]) };

    const provider = new EmailListingsProvider(baseConfig, parser);
    const results = await provider.fetchNewOrUpdatedListings(new Date(0));

    expect(geocodeAddress).toHaveBeenCalledWith("123 Bank St");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: "email",
      providerListingId: "SPEC-1",
      address: "123 Bank St",
      lat: 45.41,
      lng: -75.69,
      listPrice: 850000,
      lotAreaSqm: 450,
    });
    expect(results[0].zoneCode).toBeUndefined();
  });

  it("filters messages by sender when fromFilter is configured", async () => {
    const provider = new EmailListingsProvider({
      ...baseConfig,
      fromFilter: "someoneelse@example.com",
    });
    const results = await provider.fetchNewOrUpdatedListings(new Date(0));

    expect(results).toEqual([]);
  });
});
