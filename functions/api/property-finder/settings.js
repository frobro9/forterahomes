import { badRequest } from '../../_lib/http.js';

const PREFERENCE_FIELDS = {
  targetNeighborhoods: { column: 'target_neighborhoods_json', json: true },
  minLotSize: { column: 'min_lot_size' },
  minCapRate: { column: 'min_cap_rate' },
  minRoi: { column: 'min_roi' },
  defaultPropertyTypes: { column: 'default_property_types_json', json: true },
  priceMin: { column: 'price_min' },
  priceMax: { column: 'price_max' },
};

const ASSUMPTION_FIELDS = {
  costPerSqft: { column: 'cost_per_sqft' },
  softCostPct: { column: 'soft_cost_pct' },
  downPaymentPct: { column: 'down_payment_pct' },
  interestRate: { column: 'interest_rate' },
  amortizationYears: { column: 'amortization_years' },
  vacancyRatePct: { column: 'vacancy_rate_pct' },
  opexPctOfGpi: { column: 'opex_pct_of_gpi' },
};

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const { env } = context;
  const prefs = await env.DB.prepare('SELECT * FROM pf_user_preferences WHERE id = 1').first();
  const assumptions = await env.DB.prepare('SELECT * FROM pf_financial_assumptions WHERE id = 1').first();

  return Response.json({
    preferences: {
      targetNeighborhoods: parseJson(prefs.target_neighborhoods_json),
      minLotSize: prefs.min_lot_size,
      minCapRate: prefs.min_cap_rate,
      minRoi: prefs.min_roi,
      defaultPropertyTypes: parseJson(prefs.default_property_types_json),
      priceMin: prefs.price_min,
      priceMax: prefs.price_max,
    },
    assumptions: {
      costPerSqft: assumptions.cost_per_sqft,
      softCostPct: assumptions.soft_cost_pct,
      downPaymentPct: assumptions.down_payment_pct,
      interestRate: assumptions.interest_rate,
      amortizationYears: assumptions.amortization_years,
      vacancyRatePct: assumptions.vacancy_rate_pct,
      opexPctOfGpi: assumptions.opex_pct_of_gpi,
    },
  });
}

function buildUpdate(body, fieldMap) {
  const sets = [];
  const values = [];
  for (const [key, { column, json }] of Object.entries(fieldMap)) {
    if (body[key] === undefined) continue;
    sets.push(`${column} = ?`);
    values.push(json ? JSON.stringify(body[key]) : body[key]);
  }
  return { sets, values };
}

export async function onRequestPatch(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  if (body.preferences && typeof body.preferences === 'object') {
    const { sets, values } = buildUpdate(body.preferences, PREFERENCE_FIELDS);
    if (sets.length) {
      await env.DB.prepare(`UPDATE pf_user_preferences SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = 1`)
        .bind(...values)
        .run();
    }
  }

  if (body.assumptions && typeof body.assumptions === 'object') {
    const { sets, values } = buildUpdate(body.assumptions, ASSUMPTION_FIELDS);
    if (sets.length) {
      await env.DB.prepare(`UPDATE pf_financial_assumptions SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = 1`)
        .bind(...values)
        .run();
    }
  }

  return onRequestGet(context);
}
