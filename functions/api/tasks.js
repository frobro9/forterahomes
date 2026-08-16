import { badRequest } from '../_lib/http.js';
import { TASK_PRIORITIES, DATE_RE, DEFAULT_PROPERTY, isValidOwnerValue } from '../_lib/portal-constants.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const property = url.searchParams.get('property') || DEFAULT_PROPERTY;

  const { results } = await env.DB.prepare(
    'SELECT id, property, name, priority, owner, due_date, completed, created_at FROM tasks WHERE property = ?1 ORDER BY created_at DESC'
  )
    .bind(property)
    .all();

  const tasks = results.map((t) => ({ ...t, completed: Boolean(t.completed) }));
  return Response.json({ tasks });
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
  const priority = typeof body.priority === 'string' ? body.priority : '';
  const owner = typeof body.owner === 'string' ? body.owner : '';
  const dueDate = body.dueDate === undefined || body.dueDate === null || body.dueDate === '' ? null : body.dueDate;
  const property = typeof body.property === 'string' && body.property ? body.property : DEFAULT_PROPERTY;

  if (!name || name.length > 200) return badRequest('Name is required (max 200 characters).');
  if (!TASK_PRIORITIES.includes(priority)) return badRequest('Invalid priority.');
  if (!isValidOwnerValue(owner)) return badRequest('Invalid owner.');
  if (dueDate !== null && !DATE_RE.test(dueDate)) return badRequest('Invalid due date.');

  const row = await env.DB.prepare(
    `INSERT INTO tasks (property, name, priority, owner, due_date)
     VALUES (?1, ?2, ?3, ?4, ?5)
     RETURNING id, property, name, priority, owner, due_date, completed, created_at`
  )
    .bind(property, name, priority, owner, dueDate)
    .first();

  return Response.json({ task: { ...row, completed: Boolean(row.completed) } }, { status: 201 });
}
