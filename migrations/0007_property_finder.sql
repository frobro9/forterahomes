-- Property Finder: acquisition-opportunity dashboard fed by the mls-scraper
-- pipeline (external GitHub Actions job, Node/Playwright/Claude — see
-- functions/api/property-finder/ingest.js). D1 stores only the pipeline's
-- FINAL computed fields per listing/run; the zoning rules engine, GIS
-- matching, and Zoning By-law 2026-50 reference tables (zones,
-- overlay_rules) continue to live in mls-scraper's own Postgres and are
-- NOT mirrored here. `pf_` prefix distinguishes this from the `property`
-- column used elsewhere (meetings/tasks), which means a Fortera
-- development like "beechwood", not an external listing.

CREATE TABLE IF NOT EXISTS pf_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  provider_listing_id TEXT NOT NULL,
  address TEXT NOT NULL,
  neighborhood TEXT,
  lat REAL,
  lng REAL,
  list_price REAL NOT NULL,
  lot_size_sqft REAL,
  lot_width_m REAL,
  lot_depth_m REAL,
  building_sqft REAL,
  year_built INTEGER,
  property_type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  raw_payload_json TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pf_listings_provider_id
  ON pf_listings(provider, provider_listing_id);
CREATE INDEX IF NOT EXISTS idx_pf_listings_neighborhood ON pf_listings(neighborhood);
CREATE INDEX IF NOT EXISTS idx_pf_listings_list_price ON pf_listings(list_price);

CREATE TABLE IF NOT EXISTS pf_analysis_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES pf_listings(id) ON DELETE CASCADE,
  run_date TEXT NOT NULL DEFAULT (datetime('now')),
  -- Denormalized zone snapshot (source of truth stays mls-scraper's `zones`).
  zone_code TEXT,
  zone_name TEXT,
  sub_zone_code TEXT,
  raw_zone_code TEXT,
  source_bylaw_section TEXT,
  buildable_units INTEGER NOT NULL,
  unit_mix_json TEXT,
  buildable_sqft REAL NOT NULL,
  buildable_footprint_sqm REAL,
  constraint_notes_json TEXT,
  -- Folded-in `parcels` fields (1 parcel per listing per run in practice).
  municipal_address TEXT,
  geom_geojson TEXT,
  overlay_flags_json TEXT,
  -- Pro forma outputs (computeProForma() result).
  construction_cost REAL NOT NULL,
  total_project_cost REAL NOT NULL,
  projected_rent_roll_json TEXT,
  noi REAL NOT NULL,
  cap_rate REAL NOT NULL,
  cash_on_cash_roi REAL NOT NULL,
  meets_threshold INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pf_analysis_runs_listing_id ON pf_analysis_runs(listing_id);
CREATE INDEX IF NOT EXISTS idx_pf_analysis_runs_run_date ON pf_analysis_runs(run_date);

-- Single-row (v1) settings tables, same shape as mls-scraper's Postgres
-- user_preferences/financial_assumptions. id pinned to 1 so GET never has
-- to special-case "no row yet".
CREATE TABLE IF NOT EXISTS pf_user_preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  target_neighborhoods_json TEXT,
  min_lot_size REAL,
  min_cap_rate REAL,
  min_roi REAL,
  default_property_types_json TEXT,
  price_min REAL,
  price_max REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pf_financial_assumptions (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cost_per_sqft REAL NOT NULL,
  soft_cost_pct REAL NOT NULL,
  down_payment_pct REAL NOT NULL,
  interest_rate REAL NOT NULL,
  amortization_years INTEGER NOT NULL,
  vacancy_rate_pct REAL NOT NULL,
  opex_pct_of_gpi REAL NOT NULL,
  rent_source TEXT NOT NULL DEFAULT 'seeded_table',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pf_saved_properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL UNIQUE REFERENCES pf_listings(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Values mirror mls-scraper's lib/finance/assumptions.ts DEFAULT_ASSUMPTIONS.
INSERT OR IGNORE INTO pf_user_preferences (id) VALUES (1);
INSERT OR IGNORE INTO pf_financial_assumptions
  (id, cost_per_sqft, soft_cost_pct, down_payment_pct, interest_rate,
   amortization_years, vacancy_rate_pct, opex_pct_of_gpi)
VALUES (1, 275, 0.15, 0.25, 0.055, 25, 0.03, 0.35);
