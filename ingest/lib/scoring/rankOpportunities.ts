import { AnalysisResult } from "../reports/types";

/**
 * Ranks analyzed listings best-opportunity-first (highest cap rate), with
 * listings meeting the user's thresholds surfaced ahead of those that don't.
 */
export function rankOpportunities(results: AnalysisResult[]): AnalysisResult[] {
  return [...results].sort((a, b) => {
    if (a.meetsThreshold !== b.meetsThreshold) {
      return a.meetsThreshold ? -1 : 1;
    }
    return b.proForma.capRate - a.proForma.capRate;
  });
}
