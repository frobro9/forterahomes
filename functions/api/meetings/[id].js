import { badRequest, notFound } from '../../_lib/http.js';
import { DATE_RE, isValidOwnerValue } from '../../_lib/portal-constants.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return badRequest('Invalid id.');

  const meeting = await env.DB.prepare(
    'SELECT id, property, meeting_date, attendees, notes, status, created_at, started_at, ended_at FROM meetings WHERE id = ?'
  )
    .bind(id)
    .first();
  if (!meeting) return notFound();

  const { results: topics } = await env.DB.prepare(
    'SELECT id, meeting_id, title, content, discussion, sort_order, created_at FROM meeting_topics WHERE meeting_id = ? ORDER BY sort_order ASC, id ASC'
  )
    .bind(id)
    .all();

  return Response.json({ meeting: { ...meeting, topics } });
}

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

  const current = await env.DB.prepare('SELECT id, property, status FROM meetings WHERE id = ?').bind(id).first();
  if (!current) return notFound();
  if (current.status === 'ended') return badRequest('This meeting has ended and can no longer be edited.');

  const updates = [];
  const values = [];

  if (body.meetingDate !== undefined) {
    if (!DATE_RE.test(body.meetingDate)) return badRequest('Invalid meeting date.');
    updates.push('meeting_date = ?');
    values.push(body.meetingDate);
  }
  if (body.attendees !== undefined) {
    const attendees = typeof body.attendees === 'string' ? body.attendees : '';
    if (attendees && !isValidOwnerValue(attendees)) return badRequest('Invalid attendees.');
    updates.push('attendees = ?');
    values.push(attendees);
  }
  if (body.notes !== undefined) {
    const notes = typeof body.notes === 'string' ? body.notes : '';
    if (notes.length > 8000) return badRequest('Notes are too long (max 8000 characters).');
    updates.push('notes = ?');
    values.push(notes);
  }
  if (body.status !== undefined) {
    if (body.status === 'open') {
      if (current.status !== 'draft') return badRequest('Only a draft meeting can be started.');
      const inProgress = await env.DB.prepare("SELECT id FROM meetings WHERE property = ? AND status = 'open'")
        .bind(current.property)
        .first();
      if (inProgress) return badRequest('Another meeting is already in progress.');
      updates.push('status = ?');
      values.push('open');
      updates.push('started_at = ?');
      values.push(new Date().toISOString());
    } else if (body.status === 'ended') {
      if (current.status !== 'open') return badRequest('Only an in-progress meeting can be ended.');
      updates.push('status = ?');
      values.push('ended');
      updates.push('ended_at = ?');
      values.push(new Date().toISOString());
    } else {
      return badRequest('Invalid status.');
    }
  }

  if (!updates.length) return badRequest('No fields to update.');

  values.push(id);
  const row = await env.DB.prepare(
    `UPDATE meetings SET ${updates.join(', ')} WHERE id = ? RETURNING id, property, meeting_date, attendees, notes, status, created_at, started_at, ended_at`
  )
    .bind(...values)
    .first();

  return Response.json({ meeting: row });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return badRequest('Invalid id.');

  await env.DB.prepare('DELETE FROM meeting_topics WHERE meeting_id = ?').bind(id).run();
  const result = await env.DB.prepare('DELETE FROM meetings WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return notFound();
  return Response.json({ ok: true });
}
