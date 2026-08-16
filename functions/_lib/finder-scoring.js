import { classifyZone } from './finder-zoning.js';

function clamp100(n) {
  return Math.max(0, Math.min(100, n));
}

export function analyzeProperty({ listPrice, lotSqft, zone, settings }) {
  const density = classifyZone(zone && zone.zoneMain);

  const estimatedUnits = Math.max(1, Math.round((lotSqft / 1000) * density.unitsPer1000Sqft));
  const estimatedBuildableSqft = estimatedUnits * settings.avg_unit_sqft;
  const hardCost = estimatedBuildableSqft * settings.hard_cost_per_sqft;
  const softCost = hardCost * (settings.soft_cost_pct / 100);
  const totalProjectCost = listPrice + hardCost + softCost;

  const annualGrossRent = estimatedUnits * settings.avg_monthly_rent * 12;
  const effectiveGrossIncome = annualGrossRent * (1 - settings.vacancy_pct / 100);
  const noi = effectiveGrossIncome * (1 - settings.opex_pct / 100);
  const capRate = totalProjectCost > 0 ? (noi / totalProjectCost) * 100 : 0;
  const costPerSqftLand = lotSqft > 0 ? listPrice / lotSqft : 0;

  const capRateComponent = clamp100(settings.target_cap_rate_pct > 0 ? (capRate / settings.target_cap_rate_pct) * 100 : 0);
  const costComponent = clamp100(costPerSqftLand > 0 ? (settings.target_cost_per_sqft / costPerSqftLand) * 100 : 0);
  const densityComponent = clamp100(estimatedUnits * 12);

  const weightSum = settings.weight_cap_rate + settings.weight_cost + settings.weight_density || 1;
  const score = clamp100(
    Math.round(
      (capRateComponent * settings.weight_cap_rate +
        costComponent * settings.weight_cost +
        densityComponent * settings.weight_density) /
        weightSum
    )
  );

  return {
    density,
    estimatedUnits,
    estimatedBuildableSqft,
    hardCost,
    softCost,
    totalProjectCost,
    annualGrossRent,
    effectiveGrossIncome,
    noi,
    capRate,
    costPerSqftLand,
    scoreBreakdown: { capRateComponent, costComponent, densityComponent },
    score,
  };
}
