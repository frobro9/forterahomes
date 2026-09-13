import { verifyIngestKey, unauthorized } from '../../../_lib/property-finder-auth.js';

// Every already-tracked listing's OneHome detail-page URL, so the
// standalone ingest pipeline can skip re-scraping/re-Claude-extracting a
// property it already has (see ingest/lib/providers/index.ts, which turns
// each URL into a property key via extractOneHomePropertyKey — that logic
// stays on the pipeline side rather than being duplicated here). Ingest-key
// auth, deliberately not in PROTECTED_API_PREFIXES (same reasoning as
// ingest.js).
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!verifyIngestKey(request, env)) return unauthorized();

  const { results } = await env.DB.prepare(
    `SELECT json_extract(raw_payload_json, '$.detailUrl') AS detail_url
     FROM pf_listings
     WHERE raw_payload_json IS NOT NULL`
  ).all();

  const detailUrls = results.map((r) => r.detail_url).filter((url) => typeof url === 'string' && url);
  return Response.json({ detailUrls });
}
