import { badRequest, notFound } from '../../../_lib/http.js';

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const meetingId = Number(params.id);
  if (!Number.isInteger(meetingId)) return badRequest('Invalid id.');

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!title || title.length > 200) return badRequest('Title is required (max 200 characters).');
  if (content.length > 5000) return badRequest('Content is too long (max 5000 characters).');

  const meeting = await env.DB.prepare('SELECT id, status FROM meetings WHERE id = ?').bind(meetingId).first();
  if (!meeting) return notFound('Meeting not found.');
  if (meeting.status === 'ended') return badRequest('This meeting has ended and can no longer be edited.');

  const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM meeting_topics WHERE meeting_id = ?')
    .bind(meetingId)
    .first();

  const topic = await env.DB.prepare(
    `INSERT INTO meeting_topics (meeting_id, title, content, sort_order)
     VALUES (?1, ?2, ?3, ?4)
     RETURNING id, meeting_id, title, content, sort_order, created_at`
  )
    .bind(meetingId, title, content, count)
    .first();

  return Response.json({ topic }, { status: 201 });
}
