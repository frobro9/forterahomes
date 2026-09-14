import { badRequest, notFound } from '../../_lib/http.js';

// Public endpoint — the applicant reaches this via the emailed screening
// link, with no logged-in session. Deliberately absent from
// PROTECTED_API_PREFIXES in functions/_middleware.js, same pattern as
// property-finder/ingest.js and ../inquiries.js. Auth here is the opaque
// screening_token itself (7-day expiry, single-use).
async function lookupInvited(env, token) {
  if (!token || typeof token !== 'string') return null;
  const row = await env.DB.prepare(
    `SELECT id, name, status, screening_token_expires_at FROM applicants WHERE screening_token = ?1`
  )
    .bind(token)
    .first();
  if (!row) return null;
  if (row.status !== 'invited') return null;
  if (!row.screening_token_expires_at || new Date(row.screening_token_expires_at) < new Date()) return null;
  return row;
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const applicant = await lookupInvited(env, params.token);
  if (!applicant) return notFound('This link is invalid or has expired.');
  return Response.json({ name: applicant.name });
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const applicant = await lookupInvited(env, params.token);
  if (!applicant) return notFound('This link is invalid or has expired.');

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const references = typeof body.references === 'string' ? body.references.trim().slice(0, 3000) : '';
  const incomeNotes = typeof body.incomeNotes === 'string' ? body.incomeNotes.trim().slice(0, 3000) : '';
  const rentalHistory = typeof body.rentalHistory === 'string' ? body.rentalHistory.trim().slice(0, 3000) : '';

  if (!references || !incomeNotes || !rentalHistory) {
    return badRequest('Please fill out all three fields.');
  }

  await env.DB.prepare(
    `UPDATE applicants
     SET status = 'screening_complete', screening_references = ?1, screening_income_notes = ?2,
         screening_rental_history = ?3, screening_submitted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?4`
  )
    .bind(references, incomeNotes, rentalHistory, applicant.id)
    .run();

  return Response.json({ ok: true });
}
