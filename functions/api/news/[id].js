import { badRequest, notFound } from '../../_lib/http.js';

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const username = context.data.user.username;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return badRequest('Invalid id.');

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  if (typeof body.read !== 'boolean') return badRequest('Invalid read value.');

  const item = await env.DB.prepare('SELECT id FROM news_items WHERE id = ?').bind(id).first();
  if (!item) return notFound();

  // Read state is per-user: only this user's row in news_reads changes.
  if (body.read) {
    await env.DB.prepare(
      `INSERT INTO news_reads (news_item_id, username, read_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(news_item_id, username) DO UPDATE SET read_at = excluded.read_at`
    )
      .bind(id, username, new Date().toISOString())
      .run();
  } else {
    await env.DB.prepare('DELETE FROM news_reads WHERE news_item_id = ? AND username = ?').bind(id, username).run();
  }

  const row = await env.DB.prepare(
    `SELECT n.id, n.title, n.url, n.source, n.published_at, n.query_term, n.image_url, n.created_at, r.read_at
     FROM news_items n
     LEFT JOIN news_reads r ON r.news_item_id = n.id AND r.username = ?2
     WHERE n.id = ?1`
  )
    .bind(id, username)
    .first();

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
