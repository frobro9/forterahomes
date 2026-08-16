import { badRequest } from '../_lib/http.js';
import { DATE_RE, DEFAULT_PROPERTY } from '../_lib/portal-constants.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const property = url.searchParams.get('property') || DEFAULT_PROPERTY;

  const { results } = await env.DB.prepare(
    'SELECT id, property, name, start_date, end_date, created_at FROM events WHERE property = ?1 ORDER BY start_date ASC'
  )
    .bind(property)
    .all();

  return Response.json({ events: results });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const startDate = typeof body.startDate === 'string' ? body.startDate : '';
  const endDate = typeof body.endDate === 'string' ? body.endDate : '';
  const property = typeof body.property === 'string' && body.property ? body.property : DEFAULT_PROPERTY;

  if (!name || name.length > 200) return badRequest('Name is required (max 200 characters).');
  if (!DATE_RE.test(startDate)) return badRequest('Invalid start date.');
  if (!DATE_RE.test(endDate)) return badRequest('Invalid end date.');
  if (endDate < startDate) return badRequest('End date must be on or after the start date.');

  const event = await env.DB.prepare(
    `INSERT INTO events (property, name, start_date, end_date)
     VALUES (?1, ?2, ?3, ?4)
     RETURNING id, property, name, start_date, end_date, created_at`
  )
    .bind(property, name, startDate, endDate)
    .first();

  return Response.json({ event }, { status: 201 });
}
