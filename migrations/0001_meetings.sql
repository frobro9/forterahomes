-- Team Meetings: replaces weekly slide presentations with a running record
-- of topics, closing notes, and attendance, archived meeting by meeting.
--
-- Lifecycle: 'draft' (prepped ahead of time, topics only) -> 'open'
-- (in progress, attendance + notes captured live) -> 'ended' (archived,
-- read-only). Multiple drafts may exist at once; at most one meeting may
-- be 'open' at a time (enforced in the API, not the schema).

CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property TEXT NOT NULL DEFAULT 'beechwood',
  meeting_date TEXT NOT NULL,
  attendees TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS meeting_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meeting_topics_meeting_id ON meeting_topics(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_property_status ON meetings(property, status);
