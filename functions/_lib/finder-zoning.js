// Rough density heuristic by Ottawa zoning main-category (ZONE_MAIN), expressed as
// estimated units per 1,000 sq ft of lot area. These are planning-level estimates only —
// actual unit yield depends on setbacks, height limits, parking, and lot-specific bylaw
// provisions that this tool does not model.
const ZONE_DENSITY = {
  R1: { label: 'Low Density — Single-Detached', unitsPer1000Sqft: 0.3 },
  R2: { label: 'Low-Medium Density — Semi/Duplex', unitsPer1000Sqft: 0.6 },
  R3: { label: 'Medium Density — Townhome / Low-Rise', unitsPer1000Sqft: 1.5 },
  R4: { label: 'Medium-High Density — Low-Rise Apartment', unitsPer1000Sqft: 2.5 },
  R5: { label: 'High Density — Apartment', unitsPer1000Sqft: 4.5 },
  AM: { label: 'Mixed-Use — Arterial Mainstreet', unitsPer1000Sqft: 3 },
  TM: { label: 'Mixed-Use — Traditional Mainstreet', unitsPer1000Sqft: 3 },
  GM: { label: 'Mixed-Use — General Mainstreet', unitsPer1000Sqft: 3 },
  MC: { label: 'Mixed-Use Centre', unitsPer1000Sqft: 3.5 },
  MD: { label: 'Mixed-Use Downtown', unitsPer1000Sqft: 5 },
  RU: { label: 'Rural', unitsPer1000Sqft: 0.1 },
  AG: { label: 'Agricultural', unitsPer1000Sqft: 0.05 },
  EP: { label: 'Environmental Protection', unitsPer1000Sqft: 0 },
};

const DEFAULT_DENSITY = { label: 'Unclassified / Other', unitsPer1000Sqft: 0.5 };

export function classifyZone(zoneMain) {
  if (!zoneMain) return DEFAULT_DENSITY;
  return ZONE_DENSITY[String(zoneMain).toUpperCase()] || DEFAULT_DENSITY;
}
