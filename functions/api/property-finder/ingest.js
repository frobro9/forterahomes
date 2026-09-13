import { badRequest } from '../../_lib/http.js';
import { verifyIngestKey, unauthorized } from '../../_lib/property-finder-auth.js';

// Called by forterahomes' own standalone Property Finder ingest pipeline
// (ingest/ + .github/workflows/property-finder-ingest.yml) after each run —
// not a logged-in portal user, so this does NOT go through the cookie-session
// middleware (it's deliberately absent from PROTECTED_API_PREFIXES). Auth is
// a single shared secret header instead, same pattern as
// worker/news-fetcher's x-trigger-key check on its manual /run endpoint.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!verifyIngestKey(request, env)) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  if (!Array.isArray(body.results)) {
    return badRequest('results must be an array.');
  }

  let inserted = 0;
  let updated = 0;
  let runsCreated = 0;
  const errors = [];

  for (const result of body.results) {
    const listing = result && result.listing;
    if (
      !listing ||
      typeof listing.provider !== 'string' ||
      typeof listing.providerListingId !== 'string' ||
      typeof listing.address !== 'string' ||
      typeof listing.listPrice !== 'number'
    ) {
      errors.push({ address: listing && listing.address, error: 'Missing required listing fields.' });
      continue;
    }

    try {
      const existing = await env.DB.prepare(
        'SELECT id FROM pf_listings WHERE provider = ?1 AND provider_listing_id = ?2'
      )
        .bind(listing.provider, listing.providerListingId)
        .first();

      let listingId;
      if (existing) {
        await env.DB.prepare(
          `UPDATE pf_listings SET list_price = ?1, last_seen_at = datetime('now') WHERE id = ?2`
        )
          .bind(listing.listPrice, existing.id)
          .run();
        listingId = existing.id;
        updated += 1;
      } else {
        const row = await env.DB.prepare(
          `INSERT INTO pf_listings
             (provider, provider_listing_id, address, neighborhood, lat, lng, list_price,
              lot_size_sqft, lot_width_m, lot_depth_m, building_sqft, year_built,
              property_type, status, raw_payload_json)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)
           RETURNING id`
        )
          .bind(
            listing.provider,
            listing.providerListingId,
            listing.address,
            listing.neighborhood ?? null,
            listing.lat ?? null,
            listing.lng ?? null,
            listing.listPrice,
            listing.lotSizeSqft ?? null,
            listing.lotWidthM ?? null,
            listing.lotDepthM ?? null,
            listing.buildingSqft ?? null,
            listing.yearBuilt ?? null,
            listing.propertyType ?? null,
            listing.status || 'active',
            listing.rawPayload ? JSON.stringify(listing.rawPayload) : null
          )
          .first();
        listingId = row.id;
        inserted += 1;
      }

      const zone = result.zone || {};
      const parcel = result.parcel || {};
      const buildable = result.buildable || {};
      const proForma = result.proForma || {};

      await env.DB.prepare(
        `INSERT INTO pf_analysis_runs
           (listing_id, run_date, zone_code, zone_name, sub_zone_code, raw_zone_code,
            source_bylaw_section, buildable_units, unit_mix_json, buildable_sqft,
            buildable_footprint_sqm, constraint_notes_json, municipal_address,
            geom_geojson, overlay_flags_json, construction_cost, total_project_cost,
            projected_rent_roll_json, noi, cap_rate, cash_on_cash_roi, meets_threshold)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22)`
      )
        .bind(
          listingId,
          body.runDate || new Date().toISOString(),
          zone.zoneCode ?? null,
          zone.zoneName ?? null,
          result.subZoneCode ?? null,
          result.rawZoneCode ?? null,
          zone.sourceBylawSection ?? null,
          buildable.maxUnits ?? 0,
          buildable.unitMixSuggestion ? JSON.stringify(buildable.unitMixSuggestion) : null,
          buildable.buildableSqft ?? 0,
          buildable.buildableFootprintSqm ?? null,
          buildable.constraintNotes ? JSON.stringify(buildable.constraintNotes) : null,
          parcel.municipalAddress ?? null,
          parcel.geom ? JSON.stringify(parcel.geom) : null,
          parcel.overlayFlags ? JSON.stringify(parcel.overlayFlags) : null,
          proForma.constructionCost ?? 0,
          proForma.totalProjectCost ?? 0,
          JSON.stringify({
            grossPotentialIncomeAnnual: proForma.grossPotentialIncomeAnnual ?? null,
            perUnitMonthlyRent: proForma.perUnitMonthlyRent ?? null,
          }),
          proForma.noi ?? 0,
          proForma.capRate ?? 0,
          proForma.cashOnCashRoi ?? 0,
          result.meetsThreshold ? 1 : 0
        )
        .run();
      runsCreated += 1;
    } catch (err) {
      errors.push({ address: listing.address, error: err.message });
    }
  }

  return Response.json({ inserted, updated, runsCreated, errors });
}
