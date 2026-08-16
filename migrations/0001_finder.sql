-- Property Finder Tool: assumption settings + saved analyses.

CREATE TABLE IF NOT EXISTS finder_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  hard_cost_per_sqft REAL NOT NULL DEFAULT 275,
  soft_cost_pct REAL NOT NULL DEFAULT 15,
  avg_unit_sqft REAL NOT NULL DEFAULT 750,
  avg_monthly_rent REAL NOT NULL DEFAULT 1800,
  vacancy_pct REAL NOT NULL DEFAULT 3,
  opex_pct REAL NOT NULL DEFAULT 35,
  target_cap_rate_pct REAL NOT NULL DEFAULT 5,
  target_cost_per_sqft REAL NOT NULL DEFAULT 150,
  weight_cap_rate REAL NOT NULL DEFAULT 45,
  weight_cost REAL NOT NULL DEFAULT 35,
  weight_density REAL NOT NULL DEFAULT 20,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO finder_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS finder_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  list_price REAL NOT NULL,
  lot_sqft REAL NOT NULL,
  zone_code TEXT,
  zone_main TEXT,
  zone_name TEXT,
  estimated_units INTEGER NOT NULL,
  estimated_buildable_sqft REAL NOT NULL,
  hard_cost REAL NOT NULL,
  soft_cost REAL NOT NULL,
  total_project_cost REAL NOT NULL,
  annual_gross_rent REAL NOT NULL,
  noi REAL NOT NULL,
  cap_rate REAL NOT NULL,
  cost_per_sqft_land REAL NOT NULL,
  score REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
