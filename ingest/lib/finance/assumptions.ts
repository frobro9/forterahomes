export interface FinancialAssumptions {
  costPerSqft: number;
  softCostPct: number;
  downPaymentPct: number;
  interestRate: number;
  amortizationYears: number;
  vacancyRatePct: number;
  opexPctOfGpi: number;
}

// Reasonable starting defaults for Ottawa; meant to be overridden per-user
// via the Settings page and stored in financial_assumptions.
export const DEFAULT_ASSUMPTIONS: FinancialAssumptions = {
  costPerSqft: 275,
  softCostPct: 0.15,
  downPaymentPct: 0.25,
  interestRate: 0.055,
  amortizationYears: 25,
  vacancyRatePct: 0.03,
  opexPctOfGpi: 0.35,
};

export function mergeAssumptions(
  overrides: Partial<FinancialAssumptions>
): FinancialAssumptions {
  return { ...DEFAULT_ASSUMPTIONS, ...overrides };
}
