// History tab: a date-selectable list of every listing analyzed on a given
// pipeline run day. Mirrors mls-scraper's getRunDates()/getRunsForDate() —
// dates are bucketed by calendar day (date(run_date)) since a day can have
// more than one run (a manual trigger alongside the scheduled cron), and
// each listing shows its latest result for that day rather than one row
// per run.
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const requestedDate = url.searchParams.get('date');

  const { results: dateRows } = await env.DB.prepare(
    `SELECT DISTINCT date(run_date) AS d FROM pf_analysis_runs ORDER BY d DESC`
  ).all();
  const dates = dateRows.map((row) => row.d);

  const selectedDate = requestedDate && dates.includes(requestedDate) ? requestedDate : dates[0] || null;

  let runs = [];
  if (selectedDate) {
    const { results } = await env.DB.prepare(
      `SELECT l.id, l.address, l.neighborhood, l.list_price,
              ar.zone_code, ar.sub_zone_code, ar.buildable_units, ar.cap_rate,
              ar.cash_on_cash_roi, ar.meets_threshold
       FROM pf_analysis_runs ar
       JOIN pf_listings l ON l.id = ar.listing_id
       WHERE date(ar.run_date) = ?1
         AND ar.id = (
           SELECT id FROM pf_analysis_runs
           WHERE listing_id = ar.listing_id AND date(run_date) = ?1
           ORDER BY run_date DESC, id DESC LIMIT 1
         )
       ORDER BY ar.meets_threshold DESC, ar.cap_rate DESC`
    )
      .bind(selectedDate)
      .all();

    runs = results.map((row) => ({
      id: row.id,
      address: row.address,
      neighborhood: row.neighborhood,
      listPrice: row.list_price,
      zoneCode: row.sub_zone_code || row.zone_code,
      buildableUnits: row.buildable_units,
      capRate: row.cap_rate,
      cashOnCashRoi: row.cash_on_cash_roi,
      meetsThreshold: Boolean(row.meets_threshold),
    }));
  }

  return Response.json({ dates, selectedDate, runs });
}
