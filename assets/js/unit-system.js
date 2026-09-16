/* Imperial/metric unit toggle — a plain-JS port of mls-scraper's
   UnitSystemProvider + lib/format.ts (formatLotSize/formatLength/etc).
   No React context here, so listeners are just a callback list; defaults
   to imperial (matching the original's SSR-safe default) and persists the
   choice to localStorage the same way. */

const STORAGE_KEY = 'unitSystem';
const METERS_TO_FEET = 3.28084;
// Reuses unit-mix.js's constant rather than redeclaring it under the same
// name — classic <script> tags share one global lexical scope, so a second
// top-level `const SQM_TO_SQFT` here would collide with that file's.
const SQM_PER_SQFT = window.UnitMix.SQM_TO_SQFT;

let unit = 'imperial';
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'imperial' || stored === 'metric') unit = stored;
} catch {
  // localStorage unavailable (private browsing, etc.) — stick with the default.
}

const listeners = [];

function getUnit() {
  return unit;
}

function toggleUnit() {
  unit = unit === 'imperial' ? 'metric' : 'imperial';
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // best-effort persistence only
  }
  listeners.forEach((fn) => fn(unit));
}

function onUnitChange(fn) {
  listeners.push(fn);
}

function formatSqft(value) {
  return `${Math.round(value || 0).toLocaleString('en-CA')} sqft`;
}
function formatSqm(value) {
  return `${Math.round(value || 0).toLocaleString('en-CA')} m²`;
}

/** Lot dimensions in the format Canadian real estate listings use — feet, e.g. "60 ft x 95 ft". */
function formatLotSize(lotWidthM, lotDepthM, forUnit = unit) {
  if (!lotWidthM || !lotDepthM) return '—';
  if (forUnit === 'metric') {
    const areaSqm = lotWidthM * lotDepthM;
    return `${lotWidthM.toFixed(1)} m x ${lotDepthM.toFixed(1)} m (${formatSqm(areaSqm)})`;
  }
  const widthFt = Math.round(lotWidthM * METERS_TO_FEET);
  const depthFt = Math.round(lotDepthM * METERS_TO_FEET);
  const areaSqft = widthFt * depthFt;
  return `${widthFt} ft x ${depthFt} ft (${areaSqft.toLocaleString('en-CA')} sqft)`;
}

/** A metres-native length (e.g. a setback or height), shown in the given unit system. */
function formatLength(meters, forUnit = unit) {
  return forUnit === 'imperial' ? `${(meters * METERS_TO_FEET).toFixed(1)} ft` : `${meters} m`;
}

/** A square-metres-native area (e.g. buildable footprint), shown in the given unit system. */
function formatAreaFromSqm(sqm, forUnit = unit) {
  return forUnit === 'imperial' ? formatSqft(sqm * SQM_PER_SQFT) : formatSqm(sqm);
}

/** A square-feet-native area (e.g. unit size, already computed in sqft), shown in the given unit system. */
function formatAreaFromSqft(sqft, forUnit = unit) {
  return forUnit === 'metric' ? formatSqm(sqft / SQM_PER_SQFT) : formatSqft(sqft);
}

window.UnitSystem = {
  getUnit,
  toggleUnit,
  onUnitChange,
  formatLotSize,
  formatLength,
  formatAreaFromSqm,
  formatAreaFromSqft,
};
