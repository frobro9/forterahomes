import { badRequest, notFound } from '../../_lib/http.js';
import { sendScreeningInviteEmail, sendLeaseEmail } from '../../_lib/email.js';

const SCREENING_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const APPLICANT_COLUMNS = `id, property, status, name, email, phone, layout, message, occupants, has_pets,
  pets_details, desired_move_in, employment_status, notes, screening_submitted_at,
  screening_references, screening_income_notes, screening_rental_history, created_at, updated_at`;

function serialize(row) {
  return { ...row, has_pets: Boolean(row.has_pets) };
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return badRequest('Invalid id.');

  const row = await env.DB.prepare(`SELECT ${APPLICANT_COLUMNS} FROM applicants WHERE id = ?1`).bind(id).first();
  if (!row) return notFound();
  return Response.json({ applicant: serialize(row) });
}

// Status transitions are driven by an explicit `action` rather than letting
// the client set `status` directly, since some transitions have side effects
// (generating a screening token, sending email) that must stay in sync with
// the status change.
const ACTIONS = {
  move_forward: { from: ['new', 'reviewing'], to: 'invited' },
  decline: { from: ['new', 'reviewing', 'invited', 'screening_complete'], to: 'declined' },
  pursue: { from: ['screening_complete'], to: 'lease_sent' },
  mark_leased: { from: ['lease_sent'], to: 'leased' },
};

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return badRequest('Invalid id.');

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const current = await env.DB.prepare(`SELECT ${APPLICANT_COLUMNS} FROM applicants WHERE id = ?1`).bind(id).first();
  if (!current) return notFound();

  if (body.notes !== undefined) {
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 5000) : null;
    const row = await env.DB.prepare(
      `UPDATE applicants SET notes = ?1, updated_at = datetime('now') WHERE id = ?2 RETURNING ${APPLICANT_COLUMNS}`
    )
      .bind(notes, id)
      .first();
    return Response.json({ applicant: serialize(row) });
  }

  if (body.action !== undefined) {
    const action = ACTIONS[body.action];
    if (!action) return badRequest('Invalid action.');
    if (!action.from.includes(current.status)) {
      return badRequest(`Cannot ${body.action} an applicant with status "${current.status}".`);
    }

    if (body.action === 'move_forward') {
      const token = crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date(Date.now() + SCREENING_TOKEN_TTL_MS).toISOString();
      const row = await env.DB.prepare(
        `UPDATE applicants
         SET status = 'invited', screening_token = ?1, screening_token_expires_at = ?2, updated_at = datetime('now')
         WHERE id = ?3 RETURNING ${APPLICANT_COLUMNS}`
      )
        .bind(token, expiresAt, id)
        .first();
      await sendScreeningInviteEmail(env, row, token);
      return Response.json({ applicant: serialize(row) });
    }

    if (body.action === 'pursue') {
      const row = await env.DB.prepare(
        `UPDATE applicants SET status = 'lease_sent', updated_at = datetime('now') WHERE id = ?1 RETURNING ${APPLICANT_COLUMNS}`
      )
        .bind(id)
        .first();
      await sendLeaseEmail(env, row);
      return Response.json({ applicant: serialize(row) });
    }

    const row = await env.DB.prepare(
      `UPDATE applicants SET status = ?1, updated_at = datetime('now') WHERE id = ?2 RETURNING ${APPLICANT_COLUMNS}`
    )
      .bind(action.to, id)
      .first();
    return Response.json({ applicant: serialize(row) });
  }

  return badRequest('No fields to update.');
}
