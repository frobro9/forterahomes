import { badRequest, notFound } from '../../_lib/http.js';

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

  if (typeof body.read !== 'boolean') return badRequest('Invalid read value.');
  const readAt = body.read ? new Date().toISOString() : null;

  const row = await env.DB.prepare(
    `UPDATE news_items SET read_at = ? WHERE id = ?
     RETURNING id, title, url, source, published_at, query_term, read_at, created_at`
  )
    .bind(readAt, id)
    .first();

  if (!row) return notFound();
  return Response.json({ item: row });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return badRequest('Invalid id.');

  const result = await env.DB.prepare('DELETE FROM news_items WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return notFound();
  return Response.json({ ok: true });
}
