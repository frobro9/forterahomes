-- Read/unread state must be tracked per portal user, not globally —
-- one person marking an article read shouldn't affect what anyone
-- else sees. Move it out of news_items into its own per-user table.
CREATE TABLE IF NOT EXISTS news_reads (
  news_item_id INTEGER NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (news_item_id, username)
);

ALTER TABLE news_items DROP COLUMN read_at;
