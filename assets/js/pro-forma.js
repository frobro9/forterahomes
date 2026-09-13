/* Property Finder pro forma math — a direct JS port of mls-scraper's
   lib/finance/proForma.ts (computeProForma / monthlyMortgagePayment).
   Pure functions, no DOM/fetch — kept isolated exactly like the source
   module so the "what-if" sliders can recompute instantly in the browser
   with no network round-trip. */

function monthlyMortgagePayment(principal, annualInterestRate, amortizationYears) {
  const monthlyRate = annualInterestRate / 12;
  const numPayments = amortizationYears * 12;
  if (monthlyRate === 0) return principal / numPayments;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -numPayments));
}

function computeProForma(input) {
  const { listPrice, buildableSqft, unitCount, avgUnitSqft, monthlyRentPerSqft, assumptions } = input;

  const constructionCost = buildableSqft * assumptions.costPerSqft;
  const softCosts = constructionCost * assumptions.softCostPct;
  const totalProjectCost = listPrice + constructionCost + softCosts;

  const perUnitMonthlyRent = avgUnitSqft * monthlyRentPerSqft;
  const grossPotentialIncomeAnnual = perUnitMonthlyRent * unitCount * 12;
  const effectiveGrossIncomeAnnual = grossPotentialIncomeAnnual * (1 - assumptions.vacancyRatePct);
  const operatingExpensesAnnual = effectiveGrossIncomeAnnual * assumptions.opexPctOfGpi;
  const noi = effectiveGrossIncomeAnnual - operatingExpensesAnnual;

  const capRate = totalProjectCost > 0 ? noi / totalProjectCost : 0;

  const loanAmount = totalProjectCost * (1 - assumptions.downPaymentPct);
  const annualDebtService =
    monthlyMortgagePayment(loanAmount, assumptions.interestRate, assumptions.amortizationYears) * 12;

  const downPayment = totalProjectCost * assumptions.downPaymentPct;
  const cashOnCashRoi = downPayment > 0 ? (noi - annualDebtService) / downPayment : 0;

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

window.ProForma = { computeProForma, monthlyMortgagePayment };
