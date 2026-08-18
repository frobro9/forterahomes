-- Second dedup layer alongside `url`: the same story is sometimes
-- syndicated under multiple URLs (e.g. MSN posting the identical
-- article to two different category paths), which the url-only
-- UNIQUE constraint doesn't catch. title_key is a normalized
-- (lowercased, punctuation-stripped) version of the title, populated
-- by the news-fetcher worker going forward. Existing rows are left
-- NULL, which SQLite's UNIQUE constraint never treats as a conflict,
-- so this only prevents new duplicates rather than rewriting history.
ALTER TABLE news_items ADD COLUMN title_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_items_title_key ON news_items(title_key);
