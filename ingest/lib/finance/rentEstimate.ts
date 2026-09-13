/**
 * PLACEHOLDER DATA. Seeded per-neighborhood average rent-per-sqft figures for
 * illustration only — not sourced from a verified rent survey. Replace with
 * real comps (e.g. CMHC rental market survey data, or a paid rent-comp API)
 * before relying on these numbers, and set `rentSource` in
 * financial_assumptions accordingly.
 */

export interface RentTableEntry {
  neighborhood: string;
  rentPerSqftMonthly: number;
}

export const OTTAWA_RENT_TABLE: RentTableEntry[] = [
  { neighborhood: "Centretown", rentPerSqftMonthly: 2.6 },
  { neighborhood: "The Glebe", rentPerSqftMonthly: 2.5 },
  { neighborhood: "Hintonburg", rentPerSqftMonthly: 2.4 },
  { neighborhood: "Vanier", rentPerSqftMonthly: 2.1 },
  { neighborhood: "Alta Vista", rentPerSqftMonthly: 2.0 },
  { neighborhood: "Barrhaven", rentPerSqftMonthly: 1.9 },
  { neighborhood: "Orleans", rentPerSqftMonthly: 1.85 },
  { neighborhood: "Kanata", rentPerSqftMonthly: 1.9 },
];

const FALLBACK_RENT_PER_SQFT_MONTHLY = 2.0;

export interface RentEstimateProvider {
  estimateMonthlyRentPerSqft(neighborhood: string): number;
}

export class SeededRentEstimateProvider implements RentEstimateProvider {
  estimateMonthlyRentPerSqft(neighborhood: string): number {
    const entry = OTTAWA_RENT_TABLE.find(
      (r) => r.neighborhood.toLowerCase() === neighborhood.toLowerCase()
    );
    return entry?.rentPerSqftMonthly ?? FALLBACK_RENT_PER_SQFT_MONTHLY;
  }
}
