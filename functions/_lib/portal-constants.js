export const TASK_PRIORITIES = ['high', 'medium', 'low', 'na'];
export const TASK_OWNERS = ['Cam Frohar', 'Adam Hosny', 'Ryan Gray', 'Ryan Frohar', 'Jacob Splinter', 'Other'];
export const TASK_OWNER_ALL = 'All';
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_PROPERTY = 'beechwood';

// A task's `owner` is stored as either the literal "All", or a ", "-joined
// list of one or more names drawn from TASK_OWNERS (e.g. "Cam Frohar, Ryan Gray").
export function isValidOwnerValue(value) {
  if (typeof value !== 'string' || !value) return false;
  if (value === TASK_OWNER_ALL) return true;
  const parts = value.split(', ');
  const seen = new Set();
  for (const part of parts) {
    if (!TASK_OWNERS.includes(part) || seen.has(part)) return false;
    seen.add(part);
  }
  return true;
}

// Login username -> first name, for the portal's "Welcome, {name}" greeting.
export const USER_FIRST_NAMES = {
  cam: 'Cam',
  ryan: 'Ryan',
  rgray: 'Ryan',
  adam: 'Adam',
  jacob: 'Jacob',
};
