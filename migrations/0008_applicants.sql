-- Rental applicant pipeline: inquiry form submissions land here as `status
-- = 'new'`, then move through the leasing pipeline as staff review them in
-- the Property Management Portal (see functions/api/inquiries.js,
-- functions/api/applicants.js, functions/api/applicants/[id].js,
-- functions/api/apply/[token].js).
--
-- Status lifecycle:
--   new -> reviewing -> invited -> screening_complete -> declined | lease_sent -> leased
--
-- screening_* fields are deliberately simple freeform text for phase 1 —
-- real credit checks, income-proof documents, and reference verification
-- are a follow-up integration, not built here.

CREATE TABLE IF NOT EXISTS applicants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property TEXT NOT NULL DEFAULT 'beechwood',
  status TEXT NOT NULL DEFAULT 'new',

  -- Inquiry form fields
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  layout TEXT,
  message TEXT,
  occupants INTEGER,
  has_pets INTEGER NOT NULL DEFAULT 0,
  pets_details TEXT,
  desired_move_in TEXT,
  employment_status TEXT,

  -- Internal staff notes
  notes TEXT,

  -- Secure screening-form invite (magic-link style: opaque token looked up
  -- directly in this table, not a signed session token)
  screening_token TEXT UNIQUE,
  screening_token_expires_at TEXT,
  screening_submitted_at TEXT,
  screening_references TEXT,
  screening_income_notes TEXT,
  screening_rental_history TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_applicants_status ON applicants(status);
CREATE INDEX IF NOT EXISTS idx_applicants_created_at ON applicants(created_at);
