import { badRequest, notFound } from '../../_lib/http.js';
import { DATE_RE } from '../../_lib/portal-constants.js';

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

  const existing = await env.DB.prepare('SELECT start_date, end_date FROM events WHERE id = ?')
    .bind(id)
    .first();
  if (!existing) return notFound();

  const updates = [];
  const values = [];
  let nextStart = existing.start_date;
  let nextEnd = existing.end_date;

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 200) return badRequest('Name is required (max 200 characters).');
    updates.push('name = ?');
    values.push(name);
  }
  if (body.startDate !== undefined) {
    if (!DATE_RE.test(body.startDate)) return badRequest('Invalid start date.');
    nextStart = body.startDate;
    updates.push('start_date = ?');
    values.push(body.startDate);
  }
  if (body.endDate !== undefined) {
    if (!DATE_RE.test(body.endDate)) return badRequest('Invalid end date.');
    nextEnd = body.endDate;
    updates.push('end_date = ?');
    values.push(body.endDate);
  }

  if (!updates.length) return badRequest('No fields to update.');
  if (nextEnd < nextStart) return badRequest('End date must be on or after the start date.');

  values.push(id);
  const event = await env.DB.prepare(
    `UPDATE events SET ${updates.join(', ')} WHERE id = ? RETURNING id, property, name, start_date, end_date, created_at`
  )
    .bind(...values)
    .first();

  return Response.json({ event });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return badRequest('Invalid id.');

  const result = await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return notFound();
  return Response.json({ ok: true });
}
