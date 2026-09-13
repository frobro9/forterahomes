// Shared secret-header check for the Property Finder pipeline's endpoints
// (ingest.js and pipeline/*) — the caller is forterahomes' own GitHub
// Actions ingest job, not a logged-in portal user, so these routes are
// deliberately excluded from PROTECTED_API_PREFIXES (functions/_middleware.js)
// and check this instead. Same pattern as worker/news-fetcher's x-trigger-key.
export function verifyIngestKey(request, env) {
  const expected = env.PROPERTY_FINDER_INGEST_KEY;
  return Boolean(expected) && request.headers.get('x-property-finder-ingest-key') === expected;
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
