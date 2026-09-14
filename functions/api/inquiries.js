import { badRequest } from '../_lib/http.js';
import { sendNewInquiryNotification } from '../_lib/email.js';

// Public endpoint — the rental inquiry form on register.html posts here
// directly (no logged-in session), so this is deliberately absent from
// PROTECTED_API_PREFIXES in functions/_middleware.js, same as
// property-finder/ingest.js's public-by-omission pattern.
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
  const layout = typeof body.layout === 'string' ? body.layout.trim() : null;
  const message = typeof body.message === 'string' ? body.message.trim() : null;
  const occupants = Number.isInteger(body.occupants) ? body.occupants : null;
  const hasPets = body.hasPets === true || body.hasPets === 'yes' ? 1 : 0;
  const petsDetails = typeof body.petsDetails === 'string' ? body.petsDetails.trim() : null;
  const desiredMoveIn = typeof body.desiredMoveIn === 'string' && body.desiredMoveIn ? body.desiredMoveIn : null;
  const employmentStatus = typeof body.employmentStatus === 'string' ? body.employmentStatus.trim() : null;

  if (!name || name.length > 200) return badRequest('Name is required (max 200 characters).');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest('A valid email is required.');
  if (occupants !== null && (occupants < 1 || occupants > 20)) return badRequest('Invalid number of occupants.');

  const row = await env.DB.prepare(
    `INSERT INTO applicants
       (name, email, phone, layout, message, occupants, has_pets, pets_details, desired_move_in, employment_status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     RETURNING id, name, email, status, created_at`
  )
    .bind(name, email, phone, layout, message, occupants, hasPets, petsDetails, desiredMoveIn, employmentStatus)
    .first();

  await sendNewInquiryNotification(env, {
    name, email, phone, layout, message, occupants,
    hasPets: Boolean(hasPets), petsDetails, desiredMoveIn, employmentStatus,
  });

  return Response.json({ applicant: row }, { status: 201 });
}
