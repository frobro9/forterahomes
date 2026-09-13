// Distinct pipeline run dates for the date-selectable History tab. The
// per-date listing list itself reuses feed.js with ?runDate= rather than
// duplicating the join query here.
export async function onRequestGet(context) {
  const { env } = context;

  const { results } = await env.DB.prepare(
    `SELECT run_date,
            COUNT(*) AS listing_count,
            SUM(CASE WHEN meets_threshold = 1 THEN 1 ELSE 0 END) AS meets_threshold_count
     FROM pf_analysis_runs
     GROUP BY run_date
     ORDER BY run_date DESC`
  ).all();

  const runs = results.map((row) => ({
    runDate: row.run_date,
    listingCount: row.listing_count,
    meetsThresholdCount: row.meets_threshold_count,
  }));

  return Response.json({ runs });
}
