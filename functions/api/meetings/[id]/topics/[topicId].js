import { badRequest, notFound } from '../../../../_lib/http.js';

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const topicId = Number(params.topicId);
  if (!Number.isInteger(topicId)) return badRequest('Invalid id.');

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const topic = await env.DB.prepare('SELECT id, meeting_id FROM meeting_topics WHERE id = ?').bind(topicId).first();
  if (!topic) return notFound();

  const meeting = await env.DB.prepare('SELECT status FROM meetings WHERE id = ?').bind(topic.meeting_id).first();
  if (meeting && meeting.status === 'ended') return badRequest('This meeting has ended and can no longer be edited.');

  const updates = [];
  const values = [];

  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 200) return badRequest('Title is required (max 200 characters).');
    updates.push('title = ?');
    values.push(title);
  }
  if (body.content !== undefined) {
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (content.length > 8000) return badRequest('Content is too long (max 8000 characters).');
    updates.push('content = ?');
    values.push(content);
  }
  if (body.discussion !== undefined) {
    const discussion = typeof body.discussion === 'string' ? body.discussion.trim() : '';
    if (discussion.length > 8000) return badRequest('Discussion is too long (max 8000 characters).');
    updates.push('discussion = ?');
    values.push(discussion);
  }

  if (!updates.length) return badRequest('No fields to update.');

  values.push(topicId);
  const row = await env.DB.prepare(
    `UPDATE meeting_topics SET ${updates.join(', ')} WHERE id = ? RETURNING id, meeting_id, title, content, discussion, sort_order, created_at`
  )
    .bind(...values)
    .first();

  return Response.json({ topic: row });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const topicId = Number(params.topicId);
  if (!Number.isInteger(topicId)) return badRequest('Invalid id.');

  const topic = await env.DB.prepare('SELECT id, meeting_id FROM meeting_topics WHERE id = ?').bind(topicId).first();
  if (!topic) return notFound();

  const meeting = await env.DB.prepare('SELECT status FROM meetings WHERE id = ?').bind(topic.meeting_id).first();
  if (meeting && meeting.status === 'ended') return badRequest('This meeting has ended and can no longer be edited.');

  await env.DB.prepare('DELETE FROM meeting_topics WHERE id = ?').bind(topicId).run();
  return Response.json({ ok: true });
}
