import { ZoneProvisions } from "./zoneReference";
import { applyOverlays, OverlayFlags } from "./overlays";

export interface LotDimensions {
  lotWidthM: number;
  lotDepthM: number;
  lotAreaSqm: number;
}

export interface UnitMixSuggestion {
  /** Final, achievable unit count — same value as BuildablePotential.maxUnits. */
  unitCount: number;
  /** NET rentable area per unit, after the circulation deduction below —
   * use this for rent/revenue math, not avgUnitSqftGross. */
  avgUnitSqft: number;
  /** buildableSqft / unitCount, before the circulation deduction — kept
   * for reference/debugging, not for financial calculations. */
  avgUnitSqftGross: number;
  unitsPerFloor: number;
  /** Total net rentable area across the building (all floors). */
  netRentableSqft: number;
  /** Total exit-stair core area deducted, across all floors it repeats on
   * (STAIR_CORE_AREA_SQM x number of required exits x storeys). */
  stairCoreAreaSqft: number;
  /** Total shared-corridor area deducted, across all floors (0 if the
   * final unit count doesn't need a shared corridor — see CORRIDOR_AREA_PCT). */
  corridorAreaSqft: number;
  /** Post-overlay unit count the zoning provision alone would allow,
   * before any geometric feasibility check. */
  zoningMaxUnits: number;
  /** Width-derived ceiling on unit count — see MIN_UNIT_WIDTH_M below. */
  geometricMaxUnits: number;
}

export interface BuildablePotential {
  maxUnits: number;
  maxHeightM: number;
  buildableFootprintSqm: number;
  buildableSqft: number;
  storeys: number;
  unitMixSuggestion: UnitMixSuggestion;
  constraintNotes: string[];
}

export const SQM_TO_SQFT = 10.7639;
const ASSUMED_STOREY_HEIGHT_M = 3.5;

// Ottawa's as-of-right low/mid-rise "missing middle" provisions (multiplexes,
// low-rise apartments) top out around 4 storeys before a project needs
// different (site plan control) review — so even a site whose height
// allowance would geometrically fit more storeys at ASSUMED_STOREY_HEIGHT_M
// is capped here, rather than letting a tall height limit alone imply a
// 5-6 storey walk-up.
const MAX_RESIDENTIAL_STOREYS = 4;
// Compact-but-livable unit frontage (real window exposure, a code-compliant
// room width) for Canadian missing-middle multiplex housing. Below this,
// a zoning provision's unit count isn't actually achievable — see the
// geometric feasibility check below.
const MIN_UNIT_WIDTH_M = 4.5;
// Compact-but-livable minimum NET unit area (studio/1-bed scale), paired
// with MIN_UNIT_WIDTH_M so achievable units-per-floor is sized off both
// frontage and actual floor area left over after the stair core — not
// width alone, which could otherwise imply units too small to be real.
export const MIN_UNIT_AREA_SQM = 40;
// One enclosed exit stair including walls, run, and landings — roughly a
// 3m x 4m envelope, repeated on every floor it serves.
export const STAIR_CORE_AREA_SQM = 12;
// Simplified single-exit-vs-two-exit split: up to 2 storeys of walk-up
// residential can typically use a single exit stair; 3+ storeys needs two
// (a simplification of real Building Code travel-distance/sprinkler rules,
// not a code-compliance guarantee).
const TWO_EXIT_STOREY_THRESHOLD = 3;
// Shared corridor allowance, applied only once a floor has more than a
// couple of units (i.e. can no longer be served by direct entries off one
// small shared landing).
const CORRIDOR_AREA_PCT = 0.1;

/**
 * Storeys from a height limit, capped at MAX_RESIDENTIAL_STOREYS — the same
 * formula computeBuildablePotential uses, exported so lib/db/queries.ts can
 * re-derive it identically for persisted rows (storeys itself isn't
 * persisted; see that file for why).
 */
export function computeStoreys(maxHeightM: number): number {
  return Math.min(
    Math.max(Math.floor(maxHeightM / ASSUMED_STOREY_HEIGHT_M), 1),
    MAX_RESIDENTIAL_STOREYS
  );
}

export interface UnitMixCalc {
  unitsPerFloor: number;
  numExitStairs: number;
  netRentableSqft: number;
  avgUnitSqft: number;
  stairCoreAreaSqft: number;
  corridorAreaSqft: number;
}

/**
 * Pure, side-effect-free circulation math shared by the default calculation
 * below AND the "what-if" pro forma explorer (which reruns this client-side
 * with a user-chosen unit count and/or stair-size assumption — everything
 * here is plain arithmetic with no zone/lot/DB dependency, safe to import
 * into a client component).
 */
export function computeUnitMix({
  storeys,
  buildableSqft,
  unitCount,
  stairCoreAreaSqftPerStair = STAIR_CORE_AREA_SQM * SQM_TO_SQFT,
}: {
  storeys: number;
  /** Total gross buildable floor area across all floors, sqft (post height/coverage/FSI caps) — the construction-cost basis. */
  buildableSqft: number;
  /** Unit count to size the layout for. */
  unitCount: number;
  /** Sqft per exit stair core; defaults to STAIR_CORE_AREA_SQM converted to sqft. */
  stairCoreAreaSqftPerStair?: number;
}): UnitMixCalc {
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

/**
 * Pure function: given a zone's base provisions, a lot's dimensions, and any
 * overlay flags that apply to the parcel, compute what can be built.
 *
 * This is the highest-risk-of-error module in the system (it encodes bylaw
 * interpretation) — keep it pure and covered by unit tests against known
 * reference cases as the zone reference data is verified.
 */
export function computeBuildablePotential(
  zone: ZoneProvisions,
  lot: LotDimensions,
  overlays: OverlayFlags,
  /** Site-specific height limit in metres (e.g. from a live GIS "H(##)"
   * suffix) that overrides the zone's generic base-zone height when set. */
  heightOverrideM?: number | null
): BuildablePotential {
  const notes: string[] = [];

  const baseHeightM = heightOverrideM ?? zone.maxHeightM;
  if (heightOverrideM != null && heightOverrideM !== zone.maxHeightM) {
    notes.push(
      `Height capped at ${heightOverrideM} m by a site-specific zoning override, not the ${zone.zoneCode} base-zone default of ${zone.maxHeightM} m.`
    );
  }

  const adjusted = applyOverlays(
    {
      maxUnits: zone.maxUnits,
      maxHeightM: baseHeightM,
      sideSetbackM: zone.sideSetbackM,
    },
    overlays
  );

  if (zone.minLotAreaSqm && lot.lotAreaSqm < zone.minLotAreaSqm) {
    notes.push(
      `Lot area ${lot.lotAreaSqm} m² is below the zone minimum of ${zone.minLotAreaSqm} m²; provisions may not apply as-of-right.`
    );
  }
  if (zone.minLotWidthM && lot.lotWidthM < zone.minLotWidthM) {
    notes.push(
      `Lot width ${lot.lotWidthM} m is below the zone minimum of ${zone.minLotWidthM} m; provisions may not apply as-of-right.`
    );
  }

  // Footprint = lot area minus front/rear setbacks and both side setbacks,
  // capped by the zone's max lot coverage percentage.
  const buildableWidth = Math.max(
    lot.lotWidthM - 2 * adjusted.sideSetbackM,
    0
  );
  const buildableDepth = Math.max(
    lot.lotDepthM - zone.frontSetbackM - zone.rearSetbackM,
    0
  );
  const setbackFootprintSqm = buildableWidth * buildableDepth;
  const coverageCapSqm = lot.lotAreaSqm * (zone.maxLotCoveragePct / 100);
  const buildableFootprintSqm = Math.min(setbackFootprintSqm, coverageCapSqm);

  if (setbackFootprintSqm > coverageCapSqm) {
    notes.push(
      `Footprint capped by max lot coverage (${zone.maxLotCoveragePct}%) rather than setbacks.`
    );
  }

  const storeysByHeight = Math.max(
    Math.floor(adjusted.maxHeightM / ASSUMED_STOREY_HEIGHT_M),
    1
  );
  const storeys = computeStoreys(adjusted.maxHeightM);
  if (storeysByHeight > MAX_RESIDENTIAL_STOREYS) {
    notes.push(
      `Height (${adjusted.maxHeightM} m) would geometrically fit ${storeysByHeight} storeys at ${ASSUMED_STOREY_HEIGHT_M} m/storey, but capped at ${MAX_RESIDENTIAL_STOREYS} — Ottawa's as-of-right low/mid-rise missing-middle provisions top out around 4 storeys before triggering different (site plan control) review.`
    );
  }

  let buildableFloorAreaSqm = buildableFootprintSqm * storeys;
  if (zone.fsi) {
    const fsiCapSqm = lot.lotAreaSqm * zone.fsi;
    if (buildableFloorAreaSqm > fsiCapSqm) {
      notes.push(`Floor area capped by FSI (${zone.fsi}) rather than height/coverage.`);
      buildableFloorAreaSqm = fsiCapSqm;
    }
  }

  const buildableSqft = buildableFloorAreaSqm * SQM_TO_SQFT;
  const zoningMaxUnits = Math.max(adjusted.maxUnits, 0);

  // Geometric feasibility: a zoning provision's unit count means nothing if
  // a floor isn't physically wide enough, OR doesn't have enough net area
  // left over once its stair core is carved out, to lay out that many
  // livable units. Both checks use the SAME physical per-floor footprint
  // (buildableFootprintSqm) — not the FSI-capped total — since FSI limits
  // how much floor area you're allowed to build, not the shape of any one
  // floor plate you do build. This can only ever shrink the
  // zoning-provisioned count (or leave it unchanged), never raise it —
  // Math.min against a floodplain-zeroed zoningMaxUnits of 0 always stays 0.
  const numExitStairsDefault = storeys < TWO_EXIT_STOREY_THRESHOLD ? 1 : 2;
  const perFloorStairAreaSqm = STAIR_CORE_AREA_SQM * numExitStairsDefault;
  const perFloorNetForSizingSqm = Math.max(
    buildableFootprintSqm - perFloorStairAreaSqm,
    0
  );
  const unitsPerFloorByWidth = Math.floor(buildableWidth / MIN_UNIT_WIDTH_M);
  const unitsPerFloorByArea = Math.floor(perFloorNetForSizingSqm / MIN_UNIT_AREA_SQM);
  const unitsPerFloorGeometric = Math.min(unitsPerFloorByWidth, unitsPerFloorByArea);
  const geometricMaxUnits = unitsPerFloorGeometric * storeys;
  const maxUnits = Math.min(zoningMaxUnits, geometricMaxUnits);

  if (geometricMaxUnits < zoningMaxUnits) {
    const bindingReason =
      unitsPerFloorByWidth <= unitsPerFloorByArea
        ? `lot width (${buildableWidth.toFixed(1)} m) only fits ${unitsPerFloorByWidth} unit(s) per floor at a realistic ${MIN_UNIT_WIDTH_M} m minimum unit width`
        : `each floor's net area after its stair core only fits ${unitsPerFloorByArea} unit(s) at a ${MIN_UNIT_AREA_SQM} m² minimum unit size`;
    notes.push(
      `${bindingReason} — ${geometricMaxUnits} units achievable vs. the ${zoningMaxUnits} the zoning provision alone would allow.`
    );
  }

  // Circulation deduction, sized off the FINAL achievable unit count (not
  // the theoretical zoning number) so it reflects the actual layout. This
  // only affects avgUnitSqft/netRentableSqft (rent basis) — buildableSqft
  // (construction-cost basis) stays gross, since you still pay to build
  // the stairs and corridor.
  const unitMix = computeUnitMix({ storeys, buildableSqft, unitCount: maxUnits });

  return {
    maxUnits,
    maxHeightM: adjusted.maxHeightM,
    buildableFootprintSqm,
    buildableSqft,
    storeys,
    unitMixSuggestion: {
      unitCount: maxUnits,
      avgUnitSqft: unitMix.avgUnitSqft,
      avgUnitSqftGross: maxUnits > 0 ? buildableSqft / maxUnits : 0,
      unitsPerFloor: unitMix.unitsPerFloor,
      netRentableSqft: unitMix.netRentableSqft,
      stairCoreAreaSqft: unitMix.stairCoreAreaSqft,
      corridorAreaSqft: unitMix.corridorAreaSqft,
      zoningMaxUnits,
      geometricMaxUnits,
    },
    constraintNotes: notes,
  };
}
