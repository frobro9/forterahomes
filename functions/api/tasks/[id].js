import { badRequest, notFound } from '../../_lib/http.js';
import { TASK_PRIORITIES, TASK_OWNERS, DATE_RE } from '../../_lib/portal-constants.js';

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

  const updates = [];
  const values = [];

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 200) return badRequest('Name is required (max 200 characters).');
    updates.push('name = ?');
    values.push(name);
  }
  if (body.priority !== undefined) {
    if (!TASK_PRIORITIES.includes(body.priority)) return badRequest('Invalid priority.');
    updates.push('priority = ?');
    values.push(body.priority);
  }
  if (body.owner !== undefined) {
    if (!TASK_OWNERS.includes(body.owner)) return badRequest('Invalid owner.');
    updates.push('owner = ?');
    values.push(body.owner);
  }
  if (body.dueDate !== undefined) {
    const dueDate = body.dueDate === null || body.dueDate === '' ? null : body.dueDate;
    if (dueDate !== null && !DATE_RE.test(dueDate)) return badRequest('Invalid due date.');
    updates.push('due_date = ?');
    values.push(dueDate);
  }

  if (!updates.length) return badRequest('No fields to update.');

  values.push(id);
  const task = await env.DB.prepare(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? RETURNING id, property, name, priority, owner, due_date, created_at`
  )
    .bind(...values)
    .first();

  if (!task) return notFound();
  return Response.json({ task });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return badRequest('Invalid id.');

  const result = await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return notFound();
  return Response.json({ ok: true });
}
