import { badRequest } from '../_lib/http.js';
import { geocodeAddress, lookupZoning } from '../_lib/finder-geo.js';
import { analyzeProperty } from '../_lib/finder-scoring.js';
import { FINDER_SETTINGS_DEFAULTS } from '../_lib/finder-settings-defaults.js';

export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM finder_analyses ORDER BY created_at DESC LIMIT 50'
  ).all();
  return Response.json({ analyses: results });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const listPrice = Number(body.listPrice);
  const lotSqft = Number(body.lotSqft);

  if (!address || address.length > 300) return badRequest('Address is required.');
  if (!Number.isFinite(listPrice) || listPrice <= 0) return badRequest('Valid list price is required.');
  if (!Number.isFinite(lotSqft) || lotSqft <= 0) return badRequest('Valid lot size (sq ft) is required.');

  let geo;
  try {
    geo = await geocodeAddress(address);
  } catch {
    return badRequest('Could not reach the geocoding service. Try again in a moment.');
  }
  if (!geo) return badRequest('Could not locate that address. Check the spelling and try again.');

  let zone = null;
  try {
    zone = await lookupZoning(geo.lat, geo.lon);
  } catch {
    zone = null; // Zoning lookup is best-effort; analysis proceeds with an "unclassified" default.
  }

  const settingsRow = await env.DB.prepare('SELECT * FROM finder_settings WHERE id = 1').first();
  const settings = settingsRow || FINDER_SETTINGS_DEFAULTS;

  const result = analyzeProperty({ listPrice, lotSqft, zone, settings });

  const row = await env.DB.prepare(
    `INSERT INTO finder_analyses
      (address, list_price, lot_sqft, zone_code, zone_main, zone_name, estimated_units, estimated_buildable_sqft, hard_cost, soft_cost, total_project_cost, annual_gross_rent, noi, cap_rate, cost_per_sqft_land, score)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
     RETURNING *`
  )
    .bind(
      geo.displayName || address,
      listPrice,
      lotSqft,
      zone?.zoneCode || null,
      zone?.zoneMain || null,
      zone?.zoneName || null,
      result.estimatedUnits,
      result.estimatedBuildableSqft,
      result.hardCost,
      result.softCost,
      result.totalProjectCost,
      result.annualGrossRent,
      result.noi,
      result.capRate,
      result.costPerSqftLand,
      result.score
    )
    .first();

  return Response.json({ analysis: row, scoreBreakdown: result.scoreBreakdown }, { status: 201 });
}
