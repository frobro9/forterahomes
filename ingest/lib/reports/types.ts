import { RawListing } from "../providers/types";
import { ZoneProvisions } from "../zoning/zoneReference";
import { BuildablePotential } from "../zoning/rulesEngine";
import { ProFormaResult } from "../finance/proForma";

export interface AnalysisResult {
  listing: RawListing;
  zone: ZoneProvisions;
  buildable: BuildablePotential;
  proForma: ProFormaResult;
  meetsThreshold: boolean;
  zoneSource: "live-gis" | "manual";
  rawZoneCode?: string;
  /** e.g. "N4B" — the base zone plus subzone letter, from the live GIS
   * service's Z_SUBZONES2 field. Undefined when zoneSource is "manual". */
  subZoneCode?: string;
}

export interface OpportunityThresholds {
  minCapRate: number;
  minCashOnCashRoi: number;
}

export const DEFAULT_THRESHOLDS: OpportunityThresholds = {
  minCapRate: 0.04,
  minCashOnCashRoi: 0,
};
