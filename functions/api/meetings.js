import { badRequest } from '../_lib/http.js';
import { DATE_RE, DEFAULT_PROPERTY, MEETING_STATUSES } from '../_lib/portal-constants.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const property = url.searchParams.get('property') || DEFAULT_PROPERTY;
  const status = url.searchParams.get('status');

  let query = `SELECT id, property, meeting_date, attendees, notes, status, created_at, started_at, ended_at,
                      (SELECT COUNT(*) FROM meeting_topics t WHERE t.meeting_id = meetings.id) AS topic_count
               FROM meetings WHERE property = ?1`;
  const binds = [property];
  if (status && MEETING_STATUSES.includes(status)) {
    query += ' AND status = ?2';
    binds.push(status);
  }
  query += ' ORDER BY meeting_date DESC, id DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();

  // Drafts and the in-progress meeting are small in number and rendered
  // inline in full, so embed their topics. The archive can grow large over
  // time, so it stays lightweight (topic_count only) until a row is opened.
  const includeTopics = (status === 'draft' || status === 'open') && results.length > 0;
  if (!includeTopics) {
    return Response.json({ meetings: results });
  }

  const ids = results.map((m) => m.id);
  const placeholders = ids.map((_, i) => `?${i + 1}`).join(', ');
  const { results: topics } = await env.DB.prepare(
    `SELECT id, meeting_id, title, content, sort_order, created_at FROM meeting_topics WHERE meeting_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`
  )
    .bind(...ids)
    .all();

  const topicsByMeeting = new Map();
  for (const t of topics) {
    if (!topicsByMeeting.has(t.meeting_id)) topicsByMeeting.set(t.meeting_id, []);
    topicsByMeeting.get(t.meeting_id).push(t);
  }
  const meetings = results.map((m) => ({ ...m, topics: topicsByMeeting.get(m.id) || [] }));
  return Response.json({ meetings });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const property = typeof body.property === 'string' && body.property ? body.property : DEFAULT_PROPERTY;
  const meetingDate = typeof body.meetingDate === 'string' ? body.meetingDate : '';

  if (!DATE_RE.test(meetingDate)) return badRequest('Invalid meeting date.');

  const meeting = await env.DB.prepare(
    `INSERT INTO meetings (property, meeting_date)
     VALUES (?1, ?2)
     RETURNING id, property, meeting_date, attendees, notes, status, created_at, started_at, ended_at`
  )
    .bind(property, meetingDate)
    .first();

  return Response.json({ meeting: { ...meeting, topics: [] } }, { status: 201 });
}
