/**
 * The zone codes below (N1–N4) are REAL — confirmed live against the City
 * of Ottawa's Zoning By-law 2026-50 GIS service
 * (https://maps.ottawa.ca/arcgis/rest/services/Zoning_Bylaw_2026_50/MapServer/5,
 * field ZN_CODE2) via lib/zoning/gisMatch.ts. A live query returns codes
 * like "N4B[2249] H(11)-c" — a base zone (N4), a subzone letter (A–E,
 * denser as the letter increases), an optional bracketed site-specific
 * exception number, and optional height/other suffixes.
 * `parseBaseZoneCode()` in gisMatch.ts strips all of that down to the base
 * zone, which is what this table is keyed on.
 *
 * The NUMERIC PROVISIONS (max units, height, setbacks, coverage, FSI) below
 * are still PLACEHOLDER SCAFFOLDING, not transcribed from the bylaw text —
 * the base zone alone doesn't determine them; the subzone letter and any
 * site-specific exception do too, and that level of detail requires manual
 * transcription from the official bylaw's zone provision tables
 * (ottawa.ca) before this can be trusted for a real decision.
 */

export interface ZoneProvisions {
  zoneCode: string;
  zoneName: string;
  maxUnits: number;
  maxHeightM: number;
  minLotWidthM: number | null;
  minLotAreaSqm: number | null;
  frontSetbackM: number;
  rearSetbackM: number;
  sideSetbackM: number;
  maxLotCoveragePct: number;
  fsi: number | null;
  parkingPerUnit: number | null;
  sourceBylawSection: string;
}

export const ZONE_REFERENCE: ZoneProvisions[] = [
  {
    zoneCode: "N1",
    zoneName: "Neighbourhood Zone 1 (lowest-density, as-of-right multiplex)",
    maxUnits: 4,
    maxHeightM: 9.5,
    minLotWidthM: 15,
    minLotAreaSqm: 450,
    frontSetbackM: 3,
    rearSetbackM: 7.5,
    sideSetbackM: 1.2,
    maxLotCoveragePct: 40,
    fsi: 0.6,
    parkingPerUnit: 0,
    sourceBylawSection: "TODO: transcribe from ottawa.ca Bylaw 2026-50 provisions table, by subzone letter",
  },
  {
    zoneCode: "N2",
    zoneName: "Neighbourhood Zone 2",
    maxUnits: 6,
    maxHeightM: 11,
    minLotWidthM: 15,
    minLotAreaSqm: 450,
    frontSetbackM: 3,
    rearSetbackM: 7.5,
    sideSetbackM: 1.2,
    maxLotCoveragePct: 45,
    fsi: 0.9,
    parkingPerUnit: 0,
    sourceBylawSection: "TODO: transcribe from ottawa.ca Bylaw 2026-50 provisions table, by subzone letter",
  },
  {
    zoneCode: "N3",
    zoneName: "Neighbourhood Zone 3",
    maxUnits: 8,
    maxHeightM: 14.5,
    minLotWidthM: 15,
    minLotAreaSqm: 450,
    frontSetbackM: 2.5,
    rearSetbackM: 7.5,
    sideSetbackM: 1.2,
    maxLotCoveragePct: 50,
    fsi: 1.2,
    parkingPerUnit: 0,
    sourceBylawSection: "TODO: transcribe from ottawa.ca Bylaw 2026-50 provisions table, by subzone letter",
  },
  {
    zoneCode: "N4",
    zoneName: "Neighbourhood Zone 4 (highest-density Neighbourhood zone, main streets / transit corridors)",
    maxUnits: 12,
    maxHeightM: 18,
    minLotWidthM: 15,
    minLotAreaSqm: 450,
    frontSetbackM: 2,
    rearSetbackM: 7.5,
    sideSetbackM: 1.2,
    maxLotCoveragePct: 55,
    fsi: 1.5,
    parkingPerUnit: 0,
    sourceBylawSection: "TODO: transcribe from ottawa.ca Bylaw 2026-50 provisions table, by subzone letter",
  },
];

export function getZoneProvisions(zoneCode: string): ZoneProvisions | undefined {
  return ZONE_REFERENCE.find((z) => z.zoneCode === zoneCode);
}
