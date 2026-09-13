import { badRequest } from '../../_lib/http.js';

export async function onRequestGet(context) {
  const { env } = context;

  const { results } = await env.DB.prepare(
    `SELECT l.id, l.address, l.neighborhood, l.list_price, l.property_type, l.year_built,
            r.cap_rate, r.cash_on_cash_roi, r.buildable_units, r.meets_threshold, r.run_date,
            sp.notes, sp.saved_at
     FROM pf_saved_properties sp
     JOIN pf_listings l ON l.id = sp.listing_id
     LEFT JOIN pf_analysis_runs r ON r.id = (
       SELECT id FROM pf_analysis_runs WHERE listing_id = l.id ORDER BY run_date DESC, id DESC LIMIT 1
     )
     ORDER BY sp.saved_at DESC`
  ).all();

  const saved = results.map((row) => ({
    id: row.id,
    address: row.address,
    neighborhood: row.neighborhood,
    listPrice: row.list_price,
    propertyType: row.property_type,
    yearBuilt: row.year_built,
    notes: row.notes,
    savedAt: row.saved_at,
    latestRun: row.run_date
      ? {
          capRate: row.cap_rate,
          cashOnCashRoi: row.cash_on_cash_roi,
          buildableUnits: row.buildable_units,
          meetsThreshold: Boolean(row.meets_threshold),
          runDate: row.run_date,
        }
      : null,
  }));

  return Response.json({ saved });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const listingId = Number(body.listingId);
  if (!Number.isInteger(listingId)) return badRequest('Invalid listingId.');
  const notes = typeof body.notes === 'string' ? body.notes : '';

  const row = await env.DB.prepare(
    `INSERT INTO pf_saved_properties (listing_id, notes)
     VALUES (?1, ?2)
     ON CONFLICT(listing_id) DO UPDATE SET notes = excluded.notes
     RETURNING id, listing_id, notes, saved_at`
  )
    .bind(listingId, notes)
    .first();

  return Response.json({ saved: row }, { status: 201 });
}
