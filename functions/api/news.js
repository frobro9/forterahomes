export async function onRequestGet(context) {
  const { env } = context;

  const { results } = await env.DB.prepare(
    `SELECT id, title, url, source, published_at, query_term, read_at, created_at
     FROM news_items
     ORDER BY COALESCE(published_at, created_at) DESC, id DESC
     LIMIT 200`
  ).all();

  return Response.json({ items: results });
}
