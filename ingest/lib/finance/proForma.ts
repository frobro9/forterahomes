import { FinancialAssumptions } from "./assumptions";

export interface ProFormaInput {
  listPrice: number;
  buildableSqft: number;
  unitCount: number;
  avgUnitSqft: number;
  monthlyRentPerSqft: number;
  assumptions: FinancialAssumptions;
}

export interface ProFormaResult {
  constructionCost: number;
  softCosts: number;
  totalProjectCost: number;
  grossPotentialIncomeAnnual: number;
  effectiveGrossIncomeAnnual: number;
  operatingExpensesAnnual: number;
  noi: number;
  capRate: number;
  loanAmount: number;
  annualDebtService: number;
  cashOnCashRoi: number;
  perUnitMonthlyRent: number;
}

export function monthlyMortgagePayment(
  principal: number,
  annualInterestRate: number,
  amortizationYears: number
): number {
  const monthlyRate = annualInterestRate / 12;
  const numPayments = amortizationYears * 12;
  if (monthlyRate === 0) return principal / numPayments;
  return (
    (principal * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -numPayments))
  );
}

/**
 * Pure function pro forma calculation, standard real-estate math. Designed
 * to be callable directly from the dashboard's "what-if" sliders for live
 * recalculation as assumptions change, without re-running the full pipeline.
 */
export function computeProForma(input: ProFormaInput): ProFormaResult {
  const { listPrice, buildableSqft, unitCount, avgUnitSqft, monthlyRentPerSqft, assumptions } =
    input;

  const constructionCost = buildableSqft * assumptions.costPerSqft;
  const softCosts = constructionCost * assumptions.softCostPct;
  const totalProjectCost = listPrice + constructionCost + softCosts;

  const perUnitMonthlyRent = avgUnitSqft * monthlyRentPerSqft;
  const grossPotentialIncomeAnnual = perUnitMonthlyRent * unitCount * 12;
  const effectiveGrossIncomeAnnual =
    grossPotentialIncomeAnnual * (1 - assumptions.vacancyRatePct);
  const operatingExpensesAnnual =
    effectiveGrossIncomeAnnual * assumptions.opexPctOfGpi;
  const noi = effectiveGrossIncomeAnnual - operatingExpensesAnnual;

  const capRate = totalProjectCost > 0 ? noi / totalProjectCost : 0;

  const loanAmount = totalProjectCost * (1 - assumptions.downPaymentPct);
  const annualDebtService =
    monthlyMortgagePayment(
      loanAmount,
      assumptions.interestRate,
      assumptions.amortizationYears
    ) * 12;

  const downPayment = totalProjectCost * assumptions.downPaymentPct;
  const cashOnCashRoi =
    downPayment > 0 ? (noi - annualDebtService) / downPayment : 0;

  return {
    constructionCost,
    softCosts,
    totalProjectCost,
    grossPotentialIncomeAnnual,
    effectiveGrossIncomeAnnual,
    operatingExpensesAnnual,
    noi,
    capRate,
    loanAmount,
    annualDebtService,
    cashOnCashRoi,
    perUnitMonthlyRent,
  };
}
