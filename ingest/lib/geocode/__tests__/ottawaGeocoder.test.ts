import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodeAddress } from "../ottawaGeocoder";

describe("geocodeAddress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns lat/lng/score from the top candidate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          candidates: [
            {
              address: "123 Bank St",
              score: 100,
              location: { x: -75.6995, y: 45.4197 },
            },
          ],
        })
      )
    );

    const result = await geocodeAddress("123 Bank St, Ottawa, ON");
    expect(result).toEqual({
      lat: 45.4197,
      lng: -75.6995,
      score: 100,
      matchedAddress: "123 Bank St",
    });
  });

  it("returns null when there are no candidates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ candidates: [] }))
    );

    const result = await geocodeAddress("not a real address");
    expect(result).toBeNull();
  });

  it("throws on a non-ok HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    );

    await expect(geocodeAddress("123 Bank St")).rejects.toThrow("Geocode request failed");
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
