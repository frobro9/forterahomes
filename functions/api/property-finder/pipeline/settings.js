import { verifyIngestKey, unauthorized } from '../../../_lib/property-finder-auth.js';
import { buildSettingsPayload } from '../settings.js';

// Same data as GET /api/property-finder/settings, but for the standalone
// ingest pipeline (a GitHub Actions job, no session cookie) rather than a
// logged-in portal user — so the pipeline's thresholds/assumptions actually
// track what's configured in the portal's Settings tab. Ingest-key auth,
// deliberately not in PROTECTED_API_PREFIXES (same reasoning as ingest.js).
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!verifyIngestKey(request, env)) return unauthorized();
  return Response.json(await buildSettingsPayload(env));
}
