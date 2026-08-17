-- Presenting mode: a per-topic "discussion" field captured live during the
-- meeting (questions, answers, decisions), kept separate from the topic's
-- prepared content so prep notes are never overwritten.

ALTER TABLE meeting_topics ADD COLUMN discussion TEXT NOT NULL DEFAULT '';
