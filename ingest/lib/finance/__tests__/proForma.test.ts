import { describe, expect, it } from "vitest";
import { computeProForma, monthlyMortgagePayment } from "../proForma";
import { DEFAULT_ASSUMPTIONS } from "../assumptions";

describe("monthlyMortgagePayment", () => {
  it("matches a standard known amortization reference (200k @ 4% / 30yr ≈ $954.83)", () => {
    const payment = monthlyMortgagePayment(200000, 0.04, 30);
    expect(payment).toBeCloseTo(954.83, 1);
  });
});

describe("computeProForma", () => {
  // Hand-calculated fourplex example against DEFAULT_ASSUMPTIONS.
  const input = {
    listPrice: 600_000,
    buildableSqft: 3000,
    unitCount: 4,
    avgUnitSqft: 750,
    monthlyRentPerSqft: 2.5,
    assumptions: DEFAULT_ASSUMPTIONS,
  };

  it("computes construction cost and total project cost", () => {
    const result = computeProForma(input);
    // 3000 sqft * $275/sqft
    expect(result.constructionCost).toBeCloseTo(825_000, 0);
    // 825,000 * 15% soft costs
    expect(result.softCosts).toBeCloseTo(123_750, 0);
    // 600,000 + 825,000 + 123,750
    expect(result.totalProjectCost).toBeCloseTo(1_548_750, 0);
  });

  it("computes rent roll, NOI, and cap rate", () => {
    const result = computeProForma(input);
    // 750 sqft * $2.50/sqft = $1,875/unit/month
    expect(result.perUnitMonthlyRent).toBeCloseTo(1875, 0);
    // 1875 * 4 units * 12 months
    expect(result.grossPotentialIncomeAnnual).toBeCloseTo(90_000, 0);
    // 90,000 * (1 - 3% vacancy)
    expect(result.effectiveGrossIncomeAnnual).toBeCloseTo(87_300, 0);
    // 87,300 * 35% opex
    expect(result.operatingExpensesAnnual).toBeCloseTo(30_555, 0);
    // 87,300 - 30,555
    expect(result.noi).toBeCloseTo(56_745, 0);
    // 56,745 / 1,548,750
    expect(result.capRate).toBeCloseTo(0.03664, 4);
  });

  it("computes financing figures consistent with the loan amount and mortgage formula", () => {
    const result = computeProForma(input);
    const expectedLoan = result.totalProjectCost * (1 - DEFAULT_ASSUMPTIONS.downPaymentPct);
    expect(result.loanAmount).toBeCloseTo(expectedLoan, 0);

    const expectedMonthlyPayment = monthlyMortgagePayment(
      expectedLoan,
      DEFAULT_ASSUMPTIONS.interestRate,
      DEFAULT_ASSUMPTIONS.amortizationYears
    );
    expect(result.annualDebtService).toBeCloseTo(expectedMonthlyPayment * 12, 0);

    const downPayment = result.totalProjectCost * DEFAULT_ASSUMPTIONS.downPaymentPct;
    const expectedCashOnCash = (result.noi - result.annualDebtService) / downPayment;
    expect(result.cashOnCashRoi).toBeCloseTo(expectedCashOnCash, 6);
  });

  it("responds to a higher cost-per-sqft assumption by lowering cap rate (what-if slider behavior)", () => {
    const cheaper = computeProForma(input);
    const pricier = computeProForma({
      ...input,
      assumptions: { ...DEFAULT_ASSUMPTIONS, costPerSqft: 400 },
    });
    expect(pricier.capRate).toBeLessThan(cheaper.capRate);
  });
});
