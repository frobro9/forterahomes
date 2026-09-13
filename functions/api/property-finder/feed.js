// Opportunity feed: every tracked listing joined to its most recent (or a
// specific historical, via ?runDate=) analysis run, with filtering mirroring
// the original PriceRangeSlider/NeighborhoodFilter UI.
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const priceMin = url.searchParams.get('priceMin');
  const priceMax = url.searchParams.get('priceMax');
  const neighborhood = url.searchParams.get('neighborhood');
  const minCapRate = url.searchParams.get('minCapRate');
  const runDate = url.searchParams.get('runDate');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const offset = Number(url.searchParams.get('offset')) || 0;

  const runJoin = runDate
    ? 'JOIN pf_analysis_runs r ON r.listing_id = l.id AND r.run_date = ?'
    : `JOIN pf_analysis_runs r ON r.id = (
         SELECT id FROM pf_analysis_runs WHERE listing_id = l.id ORDER BY run_date DESC, id DESC LIMIT 1
       )`;
  const joinArgs = runDate ? [runDate] : [];

  const conditions = [];
  const args = [...joinArgs];
  if (priceMin) {
    conditions.push('l.list_price >= ?');
    args.push(Number(priceMin));
  }
  if (priceMax) {
    conditions.push('l.list_price <= ?');
    args.push(Number(priceMax));
  }
  if (neighborhood) {
    conditions.push('l.neighborhood = ?');
    args.push(neighborhood);
  }
  if (minCapRate) {
    conditions.push('r.cap_rate >= ?');
    args.push(Number(minCapRate));
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { results } = await env.DB.prepare(
    `SELECT l.id, l.address, l.neighborhood, l.list_price, l.property_type, l.year_built,
            l.lat, l.lng,
            r.cap_rate, r.cash_on_cash_roi, r.buildable_units, r.meets_threshold, r.run_date,
            CASE WHEN sp.id IS NULL THEN 0 ELSE 1 END AS is_saved
     FROM pf_listings l
     ${runJoin}
     LEFT JOIN pf_saved_properties sp ON sp.listing_id = l.id
     ${whereClause}
     ORDER BY r.cap_rate DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...args, limit, offset)
    .all();

  const { results: countRows } = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM pf_listings l
     ${runJoin}
     ${whereClause}`
  )
    .bind(...args)
    .all();

  const listings = results.map((row) => ({
    id: row.id,
    address: row.address,
    neighborhood: row.neighborhood,
    listPrice: row.list_price,
    propertyType: row.property_type,
    yearBuilt: row.year_built,
    lat: row.lat,
    lng: row.lng,
    isSaved: Boolean(row.is_saved),
    latestRun: {
      capRate: row.cap_rate,
      cashOnCashRoi: row.cash_on_cash_roi,
      buildableUnits: row.buildable_units,
      meetsThreshold: Boolean(row.meets_threshold),
      runDate: row.run_date,
    },
  }));

  return Response.json({ listings, total: countRows[0]?.total ?? 0 });
}
