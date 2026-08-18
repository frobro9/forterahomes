export async function onRequestGet(context) {
  const { env } = context;
  const username = context.data.user.username;

  const { results } = await env.DB.prepare(
    `SELECT n.id, n.title, n.url, n.source, n.published_at, n.query_term, n.image_url, n.created_at, r.read_at
     FROM news_items n
     LEFT JOIN news_reads r ON r.news_item_id = n.id AND r.username = ?1
     ORDER BY COALESCE(n.published_at, n.created_at) DESC, n.id DESC
     LIMIT 200`
  )
    .bind(username)
    .all();

  return Response.json({ items: results });
}
