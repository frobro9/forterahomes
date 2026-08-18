/* ================================================================
   Fortera Homes — News Fetcher
   Runs daily (see wrangler.toml [triggers]) and on-demand via a
   secret-protected POST /run. Queries Google News RSS for development,
   zoning, and municipal policy news relevant to Ottawa, Ontario, and
   Canada, then inserts new articles into the shared D1 `news_items`
   table (unique on `url`, so re-fetching the same article is a no-op).

   Google News RSS needs no API key or signup, but returns a redirect
   link (news.google.com/rss/articles/...) rather than the publisher's
   direct URL — that's expected and still opens the article when clicked.
   ================================================================ */

const QUERIES = [
  'Ottawa development charges',
  'Ottawa zoning bylaw',
  'Ottawa municipal development',
  'Ontario development charges',
  'Ontario housing policy',
  'Canada housing development policy',
];

const MAX_PER_QUERY = 6;
const MAX_ARTICLE_AGE_DAYS = 21;

function buildRssUrl(q) {
  const params = new URLSearchParams({ q, hl: 'en-CA', gl: 'CA', ceid: 'CA:en' });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

function decodeEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!match) return '';
  let value = match[1].trim();
  const cdata = value.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdata) value = cdata[1];
  return decodeEntities(value.trim());
}

function extractSource(block) {
  const match = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
  return match ? decodeEntities(match[1].trim()) : '';
}

function parseRssItems(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks) {
    const rawTitle = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const source = extractSource(block);
    if (!rawTitle || !link) continue;

    // Google News titles are "Headline - Source Name"; strip that
    // suffix now that we have the source separately from <source>.
    let title = rawTitle;
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(source.length + 3)).trim();
    }

    const parsed = pubDate ? new Date(pubDate) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) continue;

    items.push({ title, url: link, source, publishedAt: parsed.toISOString() });
  }
  return items;
}

async function fetchQuery(query) {
  const url = buildRssUrl(query);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ForteraNewsBot/1.0)' } });
  if (!res.ok) return [];
  const xml = await res.text();

  const cutoff = Date.now() - MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000;
  return parseRssItems(xml)
    .filter((item) => new Date(item.publishedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, MAX_PER_QUERY)
    .map((item) => ({ ...item, queryTerm: query }));
}

async function runFetch(env) {
  const results = await Promise.allSettled(QUERIES.map(fetchQuery));
  const allItems = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  let inserted = 0;
  for (const item of allItems) {
    const res = await env.DB.prepare(
      `INSERT INTO news_items (title, url, source, published_at, query_term)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(url) DO NOTHING`
    )
      .bind(item.title, item.url, item.source || '', item.publishedAt, item.queryTerm)
      .run();
    if (res.meta.changes > 0) inserted += 1;
  }

  const failedQueries = results.filter((r) => r.status === 'rejected').length;
  return { checked: allItems.length, inserted, failedQueries };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runFetch(env));
  },

  // Manual trigger for operator testing/verification — not called by the
  // frontend. Requires the TRIGGER_KEY secret (`wrangler secret put`).
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/run' && request.method === 'POST') {
      if (!env.TRIGGER_KEY || request.headers.get('x-trigger-key') !== env.TRIGGER_KEY) {
        return new Response('Unauthorized', { status: 401 });
      }
      const result = await runFetch(env);
      return Response.json(result);
    }
    return new Response('OK');
  },
};
