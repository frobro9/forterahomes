import { DEFAULT_PROPERTY } from '../_lib/portal-constants.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const property = url.searchParams.get('property') || DEFAULT_PROPERTY;
  const status = url.searchParams.get('status');

  const query = status
    ? env.DB.prepare(
        `SELECT id, property, status, name, email, phone, layout, message, occupants, has_pets,
                pets_details, desired_move_in, employment_status, notes,
                screening_submitted_at, screening_references, screening_income_notes,
                screening_rental_history, created_at, updated_at
         FROM applicants WHERE property = ?1 AND status = ?2 ORDER BY created_at DESC`
      ).bind(property, status)
    : env.DB.prepare(
        `SELECT id, property, status, name, email, phone, layout, message, occupants, has_pets,
                pets_details, desired_move_in, employment_status, notes,
                screening_submitted_at, screening_references, screening_income_notes,
                screening_rental_history, created_at, updated_at
         FROM applicants WHERE property = ?1 ORDER BY created_at DESC`
      ).bind(property);

  const { results } = await query.all();
  const applicants = results.map((a) => ({ ...a, has_pets: Boolean(a.has_pets) }));
  return Response.json({ applicants });
}
