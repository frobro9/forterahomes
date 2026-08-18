/* ================================================================
   Fortera Homes — News Fetcher
   Runs daily (see wrangler.toml [triggers]) and on-demand via a
   secret-protected POST /run. Queries Bing News RSS for development,
   zoning, and municipal policy news relevant to Ottawa, Ontario, and
   Canada, then inserts new articles into the shared D1 `news_items`
   table (unique on `url`, so re-fetching the same article is a no-op).

   Bing News RSS needs no API key or signup. (Google News RSS was tried
   first, but Google returns a durable HTTP 503 to Cloudflare's shared
   Worker egress IP range regardless of headers/backoff — Bing does
   not have that problem.) Bing's <link> is a bing.com/news/apiclick.aspx
   tracking redirect wrapping the real article URL in a `url=` query
   param; we extract that real URL rather than storing the wrapper,
   since the wrapper's other tracking params appear to vary between
   requests for the same article and would otherwise defeat dedup.
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
  const params = new URLSearchParams({ q, format: 'RSS', mkt: 'en-ca' });
  return `https://www.bing.com/news/search?${params.toString()}`;
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
  const match = block.match(/<News:Source[^>]*>([\s\S]*?)<\/News:Source>/i);
  return match ? decodeEntities(match[1].trim()) : '';
}

// Bing's <link> is a tracking redirect like
// bing.com/news/apiclick.aspx?...&url=<real-article-url>&... — pull the
// real URL out so dedup keys on the actual article, not a wrapper whose
// other params can change between requests.
function extractTargetUrl(bingLink) {
  try {
    return new URL(bingLink).searchParams.get('url') || bingLink;
  } catch {
    return bingLink;
  }
}

function parseRssItems(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const source = extractSource(block);
    if (!title || !link) continue;

    const parsed = pubDate ? new Date(pubDate) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) continue;

    items.push({ title, url: extractTargetUrl(link), source, publishedAt: parsed.toISOString() });
  }
  return items;
}

// A real browser sends more than just a User-Agent; Google appears to
// rate-limit/503 requests from Cloudflare's shared Worker IP range more
// aggressively when they look automated (bare UA, no Accept headers,
// several fired at once — see fetchAllQueries below).
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-CA,en;q=0.9',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchQuery(query, attempt = 1) {
  const url = buildRssUrl(query);
  let res;
  try {
    res = await fetch(url, { headers: BROWSER_HEADERS });
  } catch (err) {
    return { query, error: `fetch threw: ${err.message}`, items: [] };
  }

  // A transient 503 is worth one retry after a short backoff.
  if (res.status === 503 && attempt < 3) {
    await sleep(1500 * attempt);
    return fetchQuery(query, attempt + 1);
  }
  if (!res.ok) {
    return { query, error: `HTTP ${res.status}`, items: [] };
  }

  const xml = await res.text();
  const rawCount = (xml.match(/<item>/g) || []).length;

  const cutoff = Date.now() - MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000;
  const items = parseRssItems(xml)
    .filter((item) => new Date(item.publishedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, MAX_PER_QUERY)
    .map((item) => ({ ...item, queryTerm: query }));

  return { query, error: null, rawCount, items };
}

// Run queries one at a time with a short gap, rather than all at once —
// six simultaneous requests from the same IP is a much stronger bot
// signal than six spread over a few seconds, and this only runs on a
// once-daily cron so the extra wall-clock time costs nothing.
async function fetchAllQueries() {
  const results = [];
  for (const query of QUERIES) {
    results.push(await fetchQuery(query));
    await sleep(800);
  }
  return results;
}

async function runFetch(env) {
  const results = await fetchAllQueries();
  const allItems = results.flatMap((r) => r.items);

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

  return {
    checked: allItems.length,
    inserted,
    queries: results.map((r) => ({ query: r.query, error: r.error, rawCount: r.rawCount, matched: r.items.length })),
  };
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
