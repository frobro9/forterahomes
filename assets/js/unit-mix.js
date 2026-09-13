/* Property Finder unit-mix math — a direct JS port of mls-scraper's
   lib/zoning/rulesEngine.ts (computeUnitMix). This is the same pure
   circulation math (stair core + corridor deductions) the ingest pipeline
   runs server-side; it's reused here, unmodified, so the "what-if" pro
   forma explorer can recompute it client-side for a user-chosen unit count
   and stair size with no network round-trip. */

const SQM_TO_SQFT = 10.7639;
const STAIR_CORE_AREA_SQM = 12;
// Simplified single-exit-vs-two-exit split: up to 2 storeys of walk-up
// residential can typically use a single exit stair; 3+ storeys needs two.
const TWO_EXIT_STOREY_THRESHOLD = 3;
// Shared corridor allowance, applied only once a floor has more than a
// couple of units.
const CORRIDOR_AREA_PCT = 0.1;

function computeUnitMix({
  storeys,
  buildableSqft,
  unitCount,
  stairCoreAreaSqftPerStair = STAIR_CORE_AREA_SQM * SQM_TO_SQFT,
}) {
  const unitsPerFloor = storeys > 0 ? Math.ceil(unitCount / storeys) : 0;
  const numExitStairs = storeys < TWO_EXIT_STOREY_THRESHOLD ? 1 : 2;
  const stairCoreAreaSqft = stairCoreAreaSqftPerStair * numExitStairs * storeys;
  const corridorAreaSqft = unitsPerFloor > 2 ? CORRIDOR_AREA_PCT * buildableSqft : 0;
  const netRentableSqft = Math.max(buildableSqft - stairCoreAreaSqft - corridorAreaSqft, 0);
  return {
    unitsPerFloor,
    numExitStairs,
    netRentableSqft,
    avgUnitSqft: unitCount > 0 ? netRentableSqft / unitCount : 0,
    stairCoreAreaSqft,
    corridorAreaSqft,
  };
}

window.UnitMix = { computeUnitMix, STAIR_CORE_AREA_SQM, SQM_TO_SQFT };
