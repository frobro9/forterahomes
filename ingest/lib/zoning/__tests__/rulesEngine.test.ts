import { describe, expect, it } from "vitest";
import { computeBuildablePotential, computeUnitMix } from "../rulesEngine";
import { ZONE_REFERENCE, getZoneProvisions } from "../zoneReference";

describe("computeBuildablePotential", () => {
  const n1 = getZoneProvisions("N1")!;
  const standardLot = { lotWidthM: 15, lotDepthM: 30, lotAreaSqm: 450 };

  it("computes a positive buildable footprint and unit count for a standard N1 lot", () => {
    const result = computeBuildablePotential(n1, standardLot, {});
    expect(result.maxUnits).toBe(n1.maxUnits);
    expect(result.buildableFootprintSqm).toBeGreaterThan(0);
    expect(result.buildableSqft).toBeGreaterThan(0);
    // A lot meeting the zone minimums shouldn't be flagged as undersized.
    expect(
      result.constraintNotes.some((n) => n.includes("below the zone minimum"))
    ).toBe(false);
  });

  it("flags undersized lots instead of silently allowing as-of-right provisions", () => {
    const tinyLot = { lotWidthM: 8, lotDepthM: 20, lotAreaSqm: 160 };
    const result = computeBuildablePotential(n1, tinyLot, {});
    expect(result.constraintNotes.length).toBeGreaterThan(0);
  });

  it("zeroes out buildable units in a floodplain overlay", () => {
    const result = computeBuildablePotential(n1, standardLot, { floodplain: true });
    expect(result.maxUnits).toBe(0);
  });

  it("caps height under a heritage overlay", () => {
    const result = computeBuildablePotential(n1, standardLot, { heritage: true });
    expect(result.maxHeightM).toBeLessThanOrEqual(9);
  });

  it("increases side setback for a corner lot, shrinking the footprint", () => {
    // A compact, shallow lot where the setback-derived footprint (not the
    // coverage cap) is the binding constraint, so the corner-lot side
    // setback bump is actually visible in the result.
    const compactLot = { lotWidthM: 15, lotDepthM: 15, lotAreaSqm: 225 };
    const withoutCorner = computeBuildablePotential(n1, compactLot, {});
    const withCorner = computeBuildablePotential(n1, compactLot, { cornerLot: true });
    expect(withCorner.buildableFootprintSqm).toBeLessThan(
      withoutCorner.buildableFootprintSqm
    );
  });

  it("does not let a transit-priority unit bump exceed what the lot width can physically fit", () => {
    // The overlay grants a zoning unit bump (+2) with no accompanying
    // width/floor-area bonus. At the 4.5m minimum unit width, standardLot's
    // 12.6m buildable width only fits 2 units/floor x 2 storeys = 4 units,
    // so the +2 bonus (would-be 6) isn't physically achievable and the
    // geometric cap correctly binds at 4 — exactly the scenario this
    // feasibility check exists to catch.
    const result = computeBuildablePotential(n1, standardLot, {
      transitPriority: true,
    });
    expect(result.maxUnits).toBe(4);
    expect(
      result.constraintNotes.some((n) => n.includes("only fits"))
    ).toBe(true);
  });

  it("caps floor area by FSI when the setback/coverage footprint would exceed it", () => {
    const n3 = getZoneProvisions("N3")!;
    const result = computeBuildablePotential(n3, standardLot, {});
    const fsiCapSqft = 450 * n3.fsi! * 10.7639;
    expect(result.buildableSqft).toBeLessThanOrEqual(fsiCapSqft + 0.01);
  });

  it("has every zone reference row resolvable by getZoneProvisions", () => {
    for (const zone of ZONE_REFERENCE) {
      expect(getZoneProvisions(zone.zoneCode)).toBeDefined();
    }
  });

  it("caps storeys at 4 even when N4's 18m height would geometrically fit 5", () => {
    const n4 = getZoneProvisions("N4")!;
    const result = computeBuildablePotential(n4, standardLot, {});
    expect(result.storeys).toBe(4);
    expect(
      result.constraintNotes.some((n) => n.includes("capped at 4"))
    ).toBe(true);
  });

  it("deducts the stair core from a floor's area before sizing units-per-floor, so a shallow lot can bind on area even though width alone would allow more", () => {
    // A minimum-width, shallow-depth N4 lot: width alone would fit 2
    // units/floor, but once the (2-exit, 4-storey) stair core is carved out
    // of the small resulting floor plate, only 1 unit/floor's worth of net
    // area is left — the area check binds tighter than both the width
    // check and the zoning table's 12-unit allowance.
    const n4 = getZoneProvisions("N4")!;
    const smallShallowLot = { lotWidthM: 15, lotDepthM: 17, lotAreaSqm: 255 };
    const result = computeBuildablePotential(n4, smallShallowLot, {});
    expect(result.maxUnits).toBe(4); // 1 unit/floor x 4 storeys
    expect(
      result.constraintNotes.some((n) => n.includes("net area after its stair core"))
    ).toBe(true);
  });
});

describe("computeUnitMix", () => {
  it("matches hand-calculated stair/corridor/net-area figures for a >2-unit-per-floor, 2-exit-stair case", () => {
    // 4 storeys, 12 units total -> 3/floor (>2, so corridor applies), 4
    // storeys >= the 2-exit threshold.
    const result = computeUnitMix({ storeys: 4, buildableSqft: 8000, unitCount: 12 });
    const stairSqftPerStair = 12 * 10.7639; // STAIR_CORE_AREA_SQM * SQM_TO_SQFT
    const expectedStairSqft = stairSqftPerStair * 2 /* exits */ * 4 /* storeys */;
    const expectedCorridorSqft = 0.1 * 8000;
    expect(result.unitsPerFloor).toBe(3);
    expect(result.numExitStairs).toBe(2);
    expect(result.stairCoreAreaSqft).toBeCloseTo(expectedStairSqft, 1);
    expect(result.corridorAreaSqft).toBeCloseTo(expectedCorridorSqft, 1);
    expect(result.netRentableSqft).toBeCloseTo(
      8000 - expectedStairSqft - expectedCorridorSqft,
      1
    );
    expect(result.avgUnitSqft).toBeCloseTo(result.netRentableSqft / 12, 1);
  });

  it("drops the corridor allowance when a what-if unit count brings units-per-floor to 2 or fewer", () => {
    const result = computeUnitMix({ storeys: 4, buildableSqft: 8000, unitCount: 8 });
    expect(result.unitsPerFloor).toBe(2);
    expect(result.corridorAreaSqft).toBe(0);
  });

  it("increases avg unit size when a what-if lowers the unit count against the same net area", () => {
    const twelve = computeUnitMix({ storeys: 4, buildableSqft: 8000, unitCount: 12 });
    const eight = computeUnitMix({ storeys: 4, buildableSqft: 8000, unitCount: 8 });
    expect(eight.avgUnitSqft).toBeGreaterThan(twelve.avgUnitSqft);
  });

  it("respects a what-if override on the per-stair area assumption", () => {
    const base = computeUnitMix({ storeys: 4, buildableSqft: 8000, unitCount: 12 });
    const smallerStairs = computeUnitMix({
      storeys: 4,
      buildableSqft: 8000,
      unitCount: 12,
      stairCoreAreaSqftPerStair: 80,
    });
    expect(smallerStairs.stairCoreAreaSqft).toBeLessThan(base.stairCoreAreaSqft);
    expect(smallerStairs.netRentableSqft).toBeGreaterThan(base.netRentableSqft);
  });
});
