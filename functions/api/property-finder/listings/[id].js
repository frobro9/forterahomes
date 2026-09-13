import { badRequest, notFound } from '../../../_lib/http.js';

// Property detail: full listing + one analysis run (latest by default, or a
// specific historical run via ?runDate= for the History tab drill-in) +
// current financial assumptions to seed the "what-if" pro forma sliders.
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return badRequest('Invalid id.');

  const url = new URL(request.url);
  const runDate = url.searchParams.get('runDate');

  const listing = await env.DB.prepare('SELECT * FROM pf_listings WHERE id = ?').bind(id).first();
  if (!listing) return notFound('Listing not found.');

  const run = runDate
    ? await env.DB.prepare('SELECT * FROM pf_analysis_runs WHERE listing_id = ? AND run_date = ?')
        .bind(id, runDate)
        .first()
    : await env.DB.prepare(
        'SELECT * FROM pf_analysis_runs WHERE listing_id = ? ORDER BY run_date DESC, id DESC LIMIT 1'
      )
        .bind(id)
        .first();

  const assumptions = await env.DB.prepare('SELECT * FROM pf_financial_assumptions WHERE id = 1').first();

  return Response.json({
    listing: { ...listing, raw_payload_json: undefined, rawPayload: parseJson(listing.raw_payload_json) },
    run: run
      ? {
          ...run,
          meetsThreshold: Boolean(run.meets_threshold),
          unitMix: parseJson(run.unit_mix_json),
          constraintNotes: parseJson(run.constraint_notes_json),
          geom: parseJson(run.geom_geojson),
          overlayFlags: parseJson(run.overlay_flags_json),
          projectedRentRoll: parseJson(run.projected_rent_roll_json),
        }
      : null,
    assumptions,
  });
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
