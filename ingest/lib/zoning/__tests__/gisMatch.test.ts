import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveGisMatcher, parseBaseZoneCode } from "../gisMatch";

describe("parseBaseZoneCode", () => {
  it("strips subzone letters, exception numbers, and height suffixes", () => {
    expect(parseBaseZoneCode("N4B[2249] H(11)-c")).toBe("N4");
    expect(parseBaseZoneCode("N3B")).toBe("N3");
    expect(parseBaseZoneCode("N2E[1340]")).toBe("N2");
    expect(parseBaseZoneCode("N4B H(11)")).toBe("N4");
    expect(parseBaseZoneCode("AG")).toBe("AG");
  });
});

describe("LiveGisMatcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves a base zone code and overlay flags from live query responses", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("MapServer/5/query")) {
        return jsonResponse({
          features: [{ attributes: { ZN_CODE2: "N4B[2249] H(11)-c", ZNAME_EN: "Neighbourhood Zone 4" } }],
        });
      }
      if (url.includes("Zoning_Bylaw_2026_50/MapServer/1/query")) {
        return jsonResponse({ features: [] });
      }
      if (url.includes("Zoning/MapServer/1/query")) {
        return jsonResponse({ features: [{ attributes: { OBJECTID: 1 } }] });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const matcher = new LiveGisMatcher();
    const result = await matcher.matchParcel(45.4023, -75.7275, "45 Wellington St W");

    expect(result).not.toBeNull();
    expect(result!.zoneCode).toBe("N4");
    expect(result!.rawZoneCode).toBe("N4B[2249] H(11)-c");
    expect(result!.overlays.floodplain).toBe(false);
    expect(result!.overlays.heritage).toBe(true);
  });

  it("returns null when the point doesn't intersect any zoning polygon, after retrying", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => jsonResponse({ features: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const matcher = new LiveGisMatcher();
    const resultPromise = matcher.matchParcel(0, 0, "Nowhere");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBeNull();
    // 3 attempts x 3 layers (zoning/floodplain/heritage) each.
    expect(fetchMock).toHaveBeenCalledTimes(9);
    vi.useRealTimers();
  });

  it("retries an empty zoning result and succeeds if a later attempt finds a match", async () => {
    vi.useFakeTimers();
    let zoningCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("MapServer/5/query")) {
        zoningCalls++;
        // Empty on the first attempt (simulating the observed
        // under-load degraded response), a real match on the second.
        if (zoningCalls === 1) return jsonResponse({ features: [] });
        return jsonResponse({ features: [{ attributes: { ZN_CODE2: "N3B" } }] });
      }
      return jsonResponse({ features: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const matcher = new LiveGisMatcher();
    const resultPromise = matcher.matchParcel(45.4, -75.7, "Retry Test");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).not.toBeNull();
    expect(result!.zoneCode).toBe("N3");
    expect(zoningCalls).toBe(2);
    vi.useRealTimers();
  });

  it("throws on a non-ok HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    );

    const matcher = new LiveGisMatcher();
    await expect(matcher.matchParcel(45, -75, "Test")).rejects.toThrow("GIS query failed");
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
