-- News feed: daily-fetched development/zoning/policy news relevant to
-- Ottawa, Ontario, and Canada. Rows are inserted by a separate Cloudflare
-- Worker (worker/news-fetcher) on a cron schedule, sharing this D1
-- database. `url` is unique so re-fetching the same article is a no-op.

CREATE TABLE IF NOT EXISTS news_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  query_term TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_items_created_at ON news_items(created_at DESC);
