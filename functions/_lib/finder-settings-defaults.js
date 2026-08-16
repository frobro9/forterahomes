// Mirrors the column defaults in migrations/0001_finder.sql — used as a fallback if a
// deployment's D1 instance hasn't been migrated yet, so the tool degrades gracefully
// instead of throwing.
export const FINDER_SETTINGS_DEFAULTS = {
  hard_cost_per_sqft: 275,
  soft_cost_pct: 15,
  avg_unit_sqft: 750,
  avg_monthly_rent: 1800,
  vacancy_pct: 3,
  opex_pct: 35,
  target_cap_rate_pct: 5,
  target_cost_per_sqft: 150,
  weight_cap_rate: 45,
  weight_cost: 35,
  weight_density: 20,
};

export const FINDER_SETTINGS_FIELDS = Object.keys(FINDER_SETTINGS_DEFAULTS);
